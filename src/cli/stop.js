import {
  readPid,
  isProcessRunning,
  killProcess,
  removePid
} from '../utils/process.js';
import {
  MASTER_PID_FILE,
  SERVER_PID_FILE,
  TUNNEL_PID_FILE
} from '../utils/paths.js';
import { writeState } from '../state.js';

export async function stopCommand() {
  const masterPid = readPid(MASTER_PID_FILE);
  const tunnelPid = readPid(TUNNEL_PID_FILE);
  let stopped = false;

  if (tunnelPid && isProcessRunning(tunnelPid)) {
    console.log(`Stopping tunnel (pid ${tunnelPid})...`);
    await killProcess(tunnelPid);
    stopped = true;
  }
  removePid(TUNNEL_PID_FILE);

  if (masterPid && isProcessRunning(masterPid)) {
    console.log(`Stopping nxcloud (pid ${masterPid})...`);
    await killProcess(masterPid);
    stopped = true;
  } else {
    const serverPid = readPid(SERVER_PID_FILE);
    if (serverPid && isProcessRunning(serverPid) && serverPid !== masterPid) {
      console.log(`Stopping server (pid ${serverPid})...`);
      await killProcess(serverPid);
      stopped = true;
    }
  }

  removePid(MASTER_PID_FILE);
  removePid(SERVER_PID_FILE);
  writeState({
    server: { status: 'stopped', pid: null },
    cloudflare: { status: 'stopped', pid: null, url: null }
  });

  if (!stopped) {
    console.log('nxcloud is not running');
    return 0;
  }

  console.log('Stopped');
  return 0;
}
