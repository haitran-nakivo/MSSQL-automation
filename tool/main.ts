import { loadToolConfig } from './config/env.ts';
import { registryStats, validateRegistry } from './registry/registry.ts';
import { startServer } from './server/server.ts';

// Entry point of the automation tool: npm run tool
const config = loadToolConfig();
const problems = validateRegistry();
const stats = registryStats();
console.log(`Registry: scope revision ${stats.revision}, ${stats.total} cases (${stats.inScope} in scope, ${stats.excluded} excluded), ${stats.implemented} implemented`);
for (const problem of problems) console.log(`Registry problem: ${problem}`);
if (!config.jiraBaseUrl || !config.jiraToken) console.log('Jira is not configured (JIRA_BASE_URL and JIRA_TOKEN in .env): the interface starts, but an execution cannot be loaded.');
startServer(config);
console.log(`Automation tool: http://127.0.0.1:${config.port}   (Ctrl+C to stop)`);
