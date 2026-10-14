// Shapes the tool uses for Jira and Xray (Server/Data Center, REST API v1 "raven"). Only the fields the tool reads are listed.

export interface ExecutionTest {
  key: string;
  // Id of the test run of this test inside the execution (the individual execution record). Null when it could not be read.
  runId: number | null;
  // Current Xray status of that run (PASS, FAIL, ABORTED, EXECUTING, TODO) or null when unknown.
  status: string | null;
  title: string;
}

export interface Execution {
  key: string;
  summary: string;
  issueType: string;
  issueStatus: string;
  fixVersions: string[];
  labels: string[];
  tests: ExecutionTest[];
  // Where the list of tests came from, so the UI can say how much to trust it.
  testsSource: 'xray-rest' | 'jira-field' | 'xray-rest+jira-field';
}

export interface TestRunInfo {
  id: number;
  status: string | null;
}

export interface EvidenceFile {
  filename: string;
  contentType: string;
  data: Buffer;
}
