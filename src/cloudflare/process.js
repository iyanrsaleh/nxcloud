import fs from 'node:fs';
import { which, spawnAttached, killProcess, isProcessRunning } from '../utils/process.js';
import { logger, appendTunnelLog } from '../logger.js';
import { writePid, removePid } from '../utils/process.js';
import { TUNNEL_PID_FILE } from '../utils/paths.js';
import { writeState } from '../state.js';
import { getLocalCloudflaredPath } from '../config.js';

let tunnelChild = null;
let publicUrl = null;

export async function findCloudflared() {
  const fromPath = await which('cloudflared');
  if (fromPath) return fromPath;

  const local = getLocalCloudflaredPath();
  if (fs.existsSync(local)) return local;

  return null;
}

export function getTunnelPublicUrl() {
  return publicUrl;
}

export function getTunnelPid() {
  return tunnelChild?.pid || null;
}

export function isTunnelRunning() {
  const pid = tunnelChild?.pid;
  return Boolean(pid && isProcessRunning(pid));
}

/**
 * Start cloudflared as a child process and capture Quick Tunnel URL from stderr/stdout.
 */
export async function startCloudflaredProcess({ binary, args, mode, publicUrlHint }) {
  if (isTunnelRunning()) {
    logger.warn('Tunnel already running');
    return { pid: tunnelChild.pid, url: publicUrl };
  }

  publicUrl = null;
  logger.info(`Starting cloudflared (${mode})...`);
  logger.debug(`cloudflared ${args.join(' ')}`);

  tunnelChild = spawnAttached(binary, args);

  writePid(TUNNEL_PID_FILE, tunnelChild.pid);
  writeState({
    cloudflare: {
      status: 'starting',
      mode,
      url: null,
      pid: tunnelChild.pid,
      startedAt: new Date().toISOString()
    }
  });

  tunnelChild.stdout?.on('data', (buf) => onTunnelOutput(buf.toString()));
  tunnelChild.stderr?.on('data', (buf) => onTunnelOutput(buf.toString()));

  tunnelChild.on('exit', (code, signal) => {
    const msg = `cloudflared exited (code=${code}, signal=${signal})`;
    logger.warn(msg);
    appendTunnelLog(msg);
    removePid(TUNNEL_PID_FILE);
    writeState({
      cloudflare: {
        status: 'stopped',
        pid: null,
        url: publicUrl
      }
    });
    tunnelChild = null;
  });

  // Wait briefly for Quick Tunnel URL
  if (mode === 'quick') {
    const url = await waitForQuickUrl(15000);
    if (url) {
      publicUrl = url;
      logger.info(`Tunnel connected: ${url}`);
      writeState({
        cloudflare: {
          status: 'connected',
          url,
          pid: tunnelChild?.pid || null
        }
      });
    } else {
      logger.warn('Tunnel started but public URL not detected yet');
      writeState({
        cloudflare: {
          status: 'running',
          pid: tunnelChild?.pid || null
        }
      });
    }
  } else {
    publicUrl = publicUrlHint || null;
    // Give named tunnel a moment to connect
    await new Promise((r) => setTimeout(r, 2000));
    const stillUp = isTunnelRunning();
    writeState({
      cloudflare: {
        status: stillUp ? 'connected' : 'stopped',
        url: publicUrl,
        pid: tunnelChild?.pid || null
      }
    });
    if (stillUp) {
      logger.info(`Named tunnel running${publicUrl ? `: ${publicUrl}` : ''}`);
    } else {
      logger.warn('Named tunnel process exited early — check logs/tunnel.log');
    }
  }

  return { pid: tunnelChild?.pid || null, url: publicUrl };
}

export async function stopCloudflaredProcess() {
  const pid = tunnelChild?.pid;
  if (!pid) {
    removePid(TUNNEL_PID_FILE);
    writeState({ cloudflare: { status: 'stopped', pid: null } });
    return false;
  }

  logger.info(`Stopping cloudflared (pid ${pid})...`);
  const ok = await killProcess(pid);
  tunnelChild = null;
  publicUrl = null;
  removePid(TUNNEL_PID_FILE);
  writeState({
    cloudflare: {
      status: 'stopped',
      pid: null,
      url: null
    }
  });
  return ok;
}

function onTunnelOutput(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    appendTunnelLog(line);
    const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match) {
      publicUrl = match[0];
      writeState({
        cloudflare: {
          status: 'connected',
          url: publicUrl
        }
      });
    }
  }
}

function waitForQuickUrl(timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (publicUrl) {
        clearInterval(timer);
        resolve(publicUrl);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(timer);
        resolve(null);
      }
    }, 200);
  });
}
