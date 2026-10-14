import * as http from 'node:http';

// A local stand-in for Jira + Xray, used only by selftest.ts. It follows the request shapes the tool sends (which come from
// Xray's public documentation); it proves the tool's code, NOT that the real Xray behaves this way.
export interface MockRequest {
  method: string;
  path: string;
  body: unknown;
  authorization: string | undefined;
}

export interface MockXray {
  baseUrl: string;
  requests: MockRequest[];
  close(): Promise<void>;
}

export const MOCK_TOKEN = 'selftest-token-123';
export const MOCK_EXECUTION = 'TST-1';
export const MOCK_RUN_ID = 777;

export async function startMockXray(uploadLimitBytes: number): Promise<MockXray> {
  const requests: MockRequest[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const url = new URL(req.url ?? '/', 'http://mock');
      let body: unknown = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
      requests.push({ method: req.method ?? '', path: url.pathname + url.search, body, authorization: req.headers.authorization });
      const reply = (code: number, value: unknown): void => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(value === null ? '' : JSON.stringify(value)); };
      if (req.headers.authorization !== `Bearer ${MOCK_TOKEN}`) return reply(401, { error: `bad token ${req.headers.authorization ?? ''}` });
      const p = url.pathname;
      if (req.method === 'GET' && p === `/rest/api/2/issue/${MOCK_EXECUTION}`) {
        return reply(200, { key: MOCK_EXECUTION, fields: { summary: 'Mock execution', status: { name: 'Open' }, issuetype: { name: 'Test Execution' }, fixVersions: [{ name: 'Mock FV' }], labels: ['mock'], customfield_10715: [{ b: 'NJM-187289', c: MOCK_RUN_ID }, { b: 'NJM-154618', c: 778 }, { b: 'NJM-999999', c: 779 }] } });
      }
      if (req.method === 'GET' && p === `/rest/raven/1.0/api/testexec/${MOCK_EXECUTION}/test`) return reply(200, [{ key: 'NJM-187289', status: 'TODO' }, { key: 'NJM-154618', status: 'TODO' }, { key: 'NJM-999999', status: 'FAIL' }]);
      if (req.method === 'POST' && p === '/rest/api/2/search') return reply(200, { issues: [{ key: 'NJM-187289', fields: { summary: 'Mock case A' } }, { key: 'NJM-154618', fields: { summary: 'Mock case B' } }, { key: 'NJM-999999', fields: { summary: 'Mock case C' } }] });
      if (req.method === 'GET' && p === '/rest/raven/1.0/api/testrun') return reply(200, { id: MOCK_RUN_ID, status: 'TODO' });
      if (req.method === 'GET' && p === `/rest/raven/1.0/api/testrun/${MOCK_RUN_ID}`) return reply(200, { id: MOCK_RUN_ID, status: 'TODO' });
      if (req.method === 'GET' && p === '/rest/api/2/attachment/meta') return reply(200, { enabled: true, uploadLimit: uploadLimitBytes });
      if (req.method === 'PUT' && p === `/rest/raven/1.0/api/testrun/${MOCK_RUN_ID}`) return reply(200, null);
      if (req.method === 'POST' && p === `/rest/raven/1.0/api/testrun/${MOCK_RUN_ID}/attachment`) return reply(200, [{ id: 1 }]);
      reply(404, { error: `no mock for ${req.method} ${p}` });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  return { baseUrl: `http://127.0.0.1:${port}`, requests, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}
