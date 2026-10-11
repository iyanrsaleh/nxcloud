import { readPid, isProcessRunning } from '../utils/process.js';
import { MASTER_PID_FILE } from '../utils/paths.js';

export async function startCommand(args = []) {
  const existing = readPid(MASTER_PID_FILE);
  if (existing && isProcessRunning(existing)) {
    console.log(`NxCloudflare already running (pid ${existing})`);
    console.log('Use: nxcloudflare status');
    return 1;
  }

  const noTunnel = args.includes('--no-tunnel');
  const { startNxCloudflare } = await import('../index.js');
  await startNxCloudflare({ tunnel: !noTunnel });
  return 0;
}
