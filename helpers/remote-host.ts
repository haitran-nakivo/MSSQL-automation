import { execFile } from 'node:child_process';
import { connect } from 'node:net';

// Looks at the transporter on a lab Windows host from the tester's PC, for the cases that remove an Inventory item and then check
// what became of the transporter on the host (observed 2026-10-07 on 10.10.19.145: service `bhsvc`, TCP port 9446; keep-transporter and
// no-uninstall leave both in place, uninstall stops the service at about 0.7 s and closes the port at about 4.5 s).
// Never asserts and never reads .env: the caller passes the host and the OS login (read in helpers/credentials.ts). The password travels
// in the child process environment, not on the command line, and is removed from any message.
//
// Two checks, because they need different things from the lab:
//  - transporterPortOpen(): a plain TCP connect to 9446. Needs nothing but the network.
//  - transporterService(): `Get-Service bhsvc` over WinRM (Invoke-Command, Negotiate) with the OS login. Needs WinRM from this PC to the
//    host (a workgroup host also needs it in this PC's TrustedHosts, which this code never changes). When it cannot connect it says
//    'Unreachable' with the reason instead of throwing, so the caller can report the check as not done.

export const TRANSPORTER_PORT = 9446;
export const TRANSPORTER_SERVICE = 'bhsvc';

export type ServiceState = 'Running' | 'Stopped' | 'Absent' | 'Unreachable';

const SERVICE_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '$secure = ConvertTo-SecureString $env:QA_OS_PASSWORD -AsPlainText -Force',
  '$cred = New-Object System.Management.Automation.PSCredential($env:QA_OS_USER, $secure)',
  '$state = Invoke-Command -ComputerName $env:QA_OS_HOST -Credential $cred -Authentication Negotiate -ScriptBlock {',
  '  param($name)',
  '  $s = Get-Service -Name $name -ErrorAction SilentlyContinue',
  "  if ($s) { [string]$s.Status } else { 'Absent' }",
  '} -ArgumentList $env:QA_SERVICE_NAME',
  '[Console]::Out.WriteLine($state)',
].join('\n');

export class RemoteHost {
  constructor(
    readonly host: string,
    private readonly osUsername: string,
    private readonly osPassword: string,
  ) {}

  // True when something accepts a connection on the transporter port.
  transporterPortOpen(timeoutMs = 3_000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = connect({ host: this.host, port: TRANSPORTER_PORT });
      const done = (open: boolean): void => {
        socket.destroy();
        resolve(open);
      };
      socket.setTimeout(timeoutMs, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    });
  }

  // State of the transporter Windows service, or 'Unreachable' (with the first line of the reason) when WinRM could not be used.
  transporterService(timeoutMs = 60_000): Promise<{ state: ServiceState; detail: string }> {
    const env = { ...process.env, QA_OS_HOST: this.host, QA_OS_USER: this.osUsername, QA_OS_PASSWORD: this.osPassword, QA_SERVICE_NAME: TRANSPORTER_SERVICE };
    return new Promise((resolve) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SERVICE_SCRIPT],
        { env, timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 },
        (error, out, err) => {
          if (error) {
            const firstLine = (err || error.message).split(/\r?\n/).find((line) => line.trim()) ?? 'unknown error';
            return resolve({ state: 'Unreachable', detail: firstLine.split(this.osPassword).join('***') });
          }
          const text = out.trim();
          const state: ServiceState = text === 'Running' ? 'Running' : text === 'Absent' ? 'Absent' : 'Stopped';
          resolve({ state, detail: text });
        },
      );
    });
  }
}
