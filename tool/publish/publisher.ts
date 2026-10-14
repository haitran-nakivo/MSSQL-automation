import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, requireJira } from '../config/env.ts';
import type { ToolConfig } from '../config/env.ts';
import { addEvidence, getAttachmentLimit, getTestRun, getTestRunById, updateTestRun } from '../jira/xray-client.ts';
import type { RunResult } from '../runner/run-case.ts';
import { buildComment } from './comment.ts';

// Sends one run's result to the individual Xray test run: status, comment, evidence. Never runs a test and never changes a
// verdict. A failure here is reported as a publish error next to the unchanged result.

export interface PublishRecord {
  at: string;
  dryRun: boolean;
  executionKey: string;
  testRunId: number | null;
  xrayStatus: string;
  comment: string;
  statusUpdated: boolean;
  uploaded: string[];
  skipped: { name: string; reason: string }[];
  attachmentLimitBytes: number | null;
  errors: string[];
}

const IMAGE_LIMIT = 12;

const size = (bytes: number): string => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

interface Candidate {
  name: string;
  contentType: string;
}

// Which files of the run folder are evidence, in priority order: the video first, then screenshots, then status and failure files.
function candidates(result: RunResult): Candidate[] {
  const list: Candidate[] = [];
  if (result.video) list.push({ name: result.video, contentType: result.video.endsWith('.mp4') ? 'video/mp4' : 'video/webm' });
  const images = result.files.filter((f) => f.toLowerCase().endsWith('.png')).slice(0, IMAGE_LIMIT);
  for (const name of images) list.push({ name, contentType: 'image/png' });
  list.push({ name: 'status.json', contentType: 'application/json' });
  for (const name of result.files) {
    if (name === 'trace.zip' || name.endsWith('trace.zip')) list.push({ name, contentType: 'application/zip' });
    if (name.startsWith('error-context') && name.endsWith('.md')) list.push({ name, contentType: 'text/markdown' });
  }
  return list.filter((c, i) => list.findIndex((o) => o.name === c.name) === i);
}

const readRecord = (dir: string): PublishRecord | null => {
  const file = join(dir, 'publish.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as PublishRecord;
  } catch {
    return null;
  }
};

export interface PublishOptions {
  // true: look up the test run and build the comment and upload plan, but write nothing to Jira.
  dryRun: boolean;
  // Known run id of this test inside the execution (from the execution listing); looked up when absent.
  testRunId?: number | null;
}

export async function publishResult(config: ToolConfig, result: RunResult, executionKey: string, options: PublishOptions): Promise<PublishRecord> {
  const dir = join(REPO_ROOT, result.runDir);
  const previous = options.dryRun ? null : readRecord(dir);
  const alreadyUploaded = new Set(previous && !previous.dryRun ? previous.uploaded : []);
  const record: PublishRecord = {
    at: new Date().toISOString(), dryRun: options.dryRun, executionKey, testRunId: options.testRunId ?? null,
    xrayStatus: result.status, comment: '', statusUpdated: false, uploaded: [...alreadyUploaded], skipped: [], attachmentLimitBytes: null, errors: [],
  };
  const save = (): PublishRecord => {
    writeFileSync(join(dir, options.dryRun ? 'publish-dryrun.json' : 'publish.json'), JSON.stringify(record, null, 2));
    return record;
  };

  let auth: ReturnType<typeof requireJira>;
  try {
    auth = { ...requireJira(config), readOnly: options.dryRun }; // a dry run cannot write: the request layer refuses it
  } catch (error) {
    record.errors.push((error as Error).message);
    record.comment = buildComment(result, { uploaded: [], skipped: [] });
    return save();
  }

  try {
    if (record.testRunId === null) record.testRunId = (await getTestRun(auth, executionKey, result.key)).id;
    else await getTestRunById(auth, record.testRunId); // read-only check that the run exists
  } catch (error) {
    record.errors.push(`Could not find the test run of ${result.key} in ${executionKey}: ${(error as Error).message}`);
    record.comment = buildComment(result, { uploaded: [], skipped: [] });
    return save();
  }

  const runId = record.testRunId as number;

  // Plan the evidence before writing the comment, so the comment can say what was and was not attached.
  const toUpload: (Candidate & { path: string })[] = [];
  try {
    const limit = await getAttachmentLimit(auth);
    record.attachmentLimitBytes = limit.bytes;
    for (const c of candidates(result)) {
      const path = join(dir, c.name);
      if (alreadyUploaded.has(c.name)) continue;
      if (!existsSync(path)) { record.skipped.push({ name: c.name, reason: 'file not found' }); continue; }
      const fileSize = statSync(path).size;
      if (limit.bytes === 0) record.skipped.push({ name: c.name, reason: 'attachments are disabled in Jira' });
      else if (fileSize > limit.bytes) record.skipped.push({ name: c.name, reason: `${size(fileSize)} is over Jira's ${size(limit.bytes)} limit; kept in ${result.runDir}` });
      else toUpload.push({ ...c, path });
    }
  } catch (error) {
    record.errors.push(`Could not read the attachment limit: ${(error as Error).message}`);
  }
  const plannedNames = [...record.uploaded, ...toUpload.map((c) => c.name)];
  record.comment = buildComment(result, { uploaded: plannedNames, skipped: record.skipped });
  if (options.dryRun) return save();

  try {
    await updateTestRun(auth, runId, { status: result.status, comment: record.comment });
    record.statusUpdated = true;
  } catch (error) {
    record.errors.push(`Could not update the test run: ${(error as Error).message}`);
    return save();
  }
  // The comment promised these files; the list is corrected below if an upload fails.
  const confirmed = [...record.uploaded];
  for (const c of toUpload) {
    try {
      await addEvidence(auth, runId, { filename: c.name, contentType: c.contentType, data: readFileSync(c.path) });
      confirmed.push(c.name);
    } catch (error) {
      record.errors.push(`Could not upload ${c.name}: ${(error as Error).message}`);
      record.skipped.push({ name: c.name, reason: 'upload failed' });
    }
  }
  record.uploaded = confirmed;
  if (confirmed.length !== plannedNames.length) {
    // Some uploads failed after the comment was written: rewrite it so the comment matches what is attached.
    record.comment = buildComment(result, { uploaded: confirmed, skipped: record.skipped });
    try {
      await updateTestRun(auth, runId, { status: result.status, comment: record.comment });
    } catch (error) {
      record.errors.push(`Could not correct the comment: ${(error as Error).message}`);
    }
  }
  return save();
}
