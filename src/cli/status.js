import { readPid, isProcessRunning } from '../utils/process.js';
import { MASTER_PID_FILE, TUNNEL_PID_FILE } from '../utils/paths.js';
import { loadConfig } from '../config.js';
import { readState } from '../state.js';

export async function statusCommand() {
  const config = loadConfig();
  const state = readState();
  const masterPid = readPid(MASTER_PID_FILE);
  const tunnelPid = readPid(TUNNEL_PID_FILE) || state.cloudflare?.pid;

  const serverRunning = Boolean(masterPid && isProcessRunning(masterPid));
  const tunnelRunning = Boolean(tunnelPid && isProcessRunning(tunnelPid));

  const serverStatus = serverRunning ? 'RUNNING' : 'STOPPED';
  const tunnelStatus = tunnelRunning
    ? state.cloudflare?.url
      ? 'CONNECTED'
      : 'RUNNING'
    : 'STOPPED';

  console.log(`
NxCloudflare
----------------------------
Server      : ${serverStatus}
Host        : ${state.server?.host || config.server.host}
Port        : ${state.server?.port || config.server.port}
PID         : ${serverRunning ? masterPid : '-'}

Cloudflare
----------------------------
Tunnel      : ${tunnelStatus}
Mode        : ${state.cloudflare?.mode || config.cloudflare.mode || '-'}
URL         : ${state.cloudflare?.url || '-'}
Root domain : ${(config.cloudflare.rootDomains || []).join(', ') || '-'}
PID         : ${tunnelRunning ? tunnelPid : '-'}
----------------------------
`.trim());

  return 0;
}
