import { SqlHost } from './sql-host';

// What the SQL Server itself says about an Always On availability group: its replicas and their roles, its availability databases, the
// listener and any distributed AG (DAG) around it. Read only: it runs SELECTs on the system views and never changes anything.
// Used by the cases that compare what NBR shows with what the AG really is (NJM-154501 AG metadata, NJM-154503 DAG). The connection is
// made to the listener or host the case adds (TCP 1433 from the test PC; if that is not reachable the case ends ABORTED, see SqlHost).
// UNVERIFIED against the lab: written on 2026-10-14 before the lab AGs were reachable with a known SQL login.

export interface ReplicaInfo {
  server: string;
  role: string; // PRIMARY / SECONDARY / RESOLVING, as the DMV reports it
  availabilityMode: string;
}

export interface AgTruth {
  agName: string;
  listenerDns: string[];
  replicas: ReplicaInfo[];
  databases: string[];
  distributedAgs: string[];
}

// A literal for N'...' in T-SQL: only quotes need doubling (the values come from system views or the owner's .env, not from a test).
const lit = (value: string): string => value.replace(/'/g, "''");

export class AgTopology {
  private readonly sql: SqlHost;

  constructor(host: string, sqlUsername: string, sqlPassword: string) {
    this.sql = new SqlHost(host, undefined, sqlUsername, sqlPassword);
  }

  // `agName` omitted: the AG behind the listener address `host` (found by its IP) is used.
  async gather(host: string, agName?: string): Promise<AgTruth> {
    const name = agName ?? (await this.agBehindListener(host));
    const replicas = (
      await this.sql.query(
        `SELECT r.replica_server_name, ISNULL(rs.role_desc, N'UNKNOWN'), r.availability_mode_desc ` +
          `FROM sys.availability_replicas r JOIN sys.availability_groups g ON g.group_id = r.group_id ` +
          `LEFT JOIN sys.dm_hadr_availability_replica_states rs ON rs.replica_id = r.replica_id AND rs.group_id = r.group_id ` +
          `WHERE g.name = N'${lit(name)}' ORDER BY r.replica_server_name`,
      )
    ).map((r) => ({ server: r[0], role: r[1], availabilityMode: r[2] }));
    const databases = (
      await this.sql.query(
        `SELECT d.database_name FROM sys.availability_databases_cluster d JOIN sys.availability_groups g ON g.group_id = d.group_id ` +
          `WHERE g.name = N'${lit(name)}' ORDER BY d.database_name`,
      )
    ).map((r) => r[0]);
    const listenerDns = (
      await this.sql.query(
        `SELECT l.dns_name FROM sys.availability_group_listeners l JOIN sys.availability_groups g ON g.group_id = l.group_id WHERE g.name = N'${lit(name)}'`,
      )
    ).map((r) => r[0]);
    const distributedAgs = (await this.sql.query('SELECT name FROM sys.availability_groups WHERE is_distributed = 1 ORDER BY name')).map((r) => r[0]);
    return { agName: name, listenerDns, replicas, databases, distributedAgs };
  }

  // The non-distributed AG whose listener has this IP address (a host name is not resolved here: give the IP).
  private async agBehindListener(host: string): Promise<string> {
    const rows = await this.sql.query(
      `SELECT g.name FROM sys.availability_groups g JOIN sys.availability_group_listeners l ON l.group_id = g.group_id ` +
        `JOIN sys.availability_group_listener_ip_addresses a ON a.listener_id = l.listener_id WHERE a.ip_address = N'${lit(host)}' AND g.is_distributed = 0`,
    );
    if (rows.length === 0) throw new Error(`ABORTED: no availability group on the SQL Server answering at ${host} has a listener with that IP address`);
    return rows[0][0];
  }
}
