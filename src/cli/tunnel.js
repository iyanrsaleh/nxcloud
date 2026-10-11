import { loadConfig } from '../config.js';
import { readState } from '../state.js';
import { readPid, isProcessRunning } from '../utils/process.js';
import { TUNNEL_PID_FILE } from '../utils/paths.js';

export async function tunnelCommand() {
  const config = loadConfig();
  const state = readState();
  const tunnelPid = readPid(TUNNEL_PID_FILE) || state.cloudflare?.pid;
  const running = Boolean(tunnelPid && isProcessRunning(tunnelPid));

  console.log(`
Cloudflare Tunnel
----------------------------
Enabled     : ${config.cloudflare.enabled ? 'yes' : 'no'}
Mode        : ${state.cloudflare?.mode || config.cloudflare.mode}
Status      : ${running ? (state.cloudflare?.url ? 'CONNECTED' : 'RUNNING') : 'STOPPED'}
Service     : ${config.cloudflare.service}
URL         : ${state.cloudflare?.url || '-'}
Root domain : ${(config.cloudflare.rootDomains || []).join(', ') || '-'}
PID         : ${running ? tunnelPid : '-'}
----------------------------
`.trim());

  return 0;
}
