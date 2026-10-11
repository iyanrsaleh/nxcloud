import { buildTunnelArgs, resolvePublicUrl } from './config.js';
import {
  findCloudflared,
  startCloudflaredProcess,
  stopCloudflaredProcess,
  getTunnelPublicUrl,
  isTunnelRunning,
  getTunnelPid
} from './process.js';
import { logger } from '../logger.js';
import { readState } from '../state.js';

export async function startTunnel(config) {
  if (!config.cloudflare?.enabled) {
    logger.info('Cloudflare Tunnel disabled in config');
    return { skipped: true };
  }

  const binary = await findCloudflared();
  if (!binary) {
    throw new Error(
      'cloudflared not found on PATH. Install Cloudflare Tunnel (cloudflared) and ensure it is available in PATH.'
    );
  }

  const built = buildTunnelArgs(config);
  const result = await startCloudflaredProcess({
    binary,
    args: built.args,
    mode: built.mode,
    publicUrlHint: resolvePublicUrl(config)
  });

  return {
    skipped: false,
    ...result,
    mode: built.mode,
    binary,
    url: result.url || resolvePublicUrl(config)
  };
}

export async function stopTunnel() {
  return stopCloudflaredProcess();
}

export function getTunnelInfo() {
  const state = readState();
  return {
    running: isTunnelRunning(),
    pid: getTunnelPid() || state.cloudflare?.pid || null,
    url: getTunnelPublicUrl() || state.cloudflare?.url || null,
    status: state.cloudflare?.status || (isTunnelRunning() ? 'running' : 'stopped'),
    mode: state.cloudflare?.mode || null
  };
}

export { findCloudflared };
