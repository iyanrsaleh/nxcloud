import { loadConfig } from './config.js';
import { logger, setLogLevel } from './logger.js';
import { createServer } from './server.js';
import { startTunnel, stopTunnel, getTunnelInfo } from './cloudflare/tunnel.js';
import { isCloudflareLoggedIn } from './cloudflare/auth.js';
import { hasApiToken } from './cloudflare/api.js';
import { writePid, removePid, ensureDir } from './utils/process.js';
import { MASTER_PID_FILE, SERVER_PID_FILE, RUNTIME_DIR } from './utils/paths.js';
import { writeState } from './state.js';
import { platformLabel } from './utils/platform.js';

let httpServer = null;
let shuttingDown = false;

export async function startNxCloudflare(options = {}) {
  const config = loadConfig();
  setLogLevel(config.logging.level);

  ensureDir(RUNTIME_DIR);
  writePid(MASTER_PID_FILE, process.pid);

  logger.info('NxCloudflare starting');
  logger.info(`Platform: ${platformLabel()}`);
  logger.info(`Host: ${config.server.host}:${config.server.port}`);

  const getStatus = () => buildStatus(config);

  httpServer = createServer({
    host: config.server.host,
    port: config.server.port,
    getStatus,
    onStop: async () => {
      await shutdown(0);
    },
    onRestart: async () => {
      logger.warn('Restart via API: stop only — start again with CLI/Desktop');
      await shutdown(0);
    }
  });

  await httpServer.listen();
  writePid(SERVER_PID_FILE, process.pid);
  writeState({
    server: {
      status: 'running',
      host: config.server.host,
      port: config.server.port,
      pid: process.pid,
      startedAt: new Date().toISOString()
    }
  });

  let tunnelResult = null;
  const envNoTunnel = process.env.NXCLOUDFLARE_NO_TUNNEL === '1';
  const enableTunnel =
    options.tunnel !== false &&
    !envNoTunnel &&
    config.cloudflare?.enabled !== false;

  // Named tunnel cukup butuh file kredensial lokal (`.credentials/*.json`)
  // — cert.pem hanya untuk perintah manajemen (create/route dns). Dulu blok
  // ini mematikan tunnel sepenuhnya hanya karena cert tidak ada, padahal
  // tunnel-nya sendiri valid (dan `cloudflared tunnel login` rusak di
  // sebagian akun, cloudflare/cloudflared#1252).
  if (enableTunnel && config.cloudflare?.mode === 'named' && !isCloudflareLoggedIn() && !hasApiToken()) {
    logger.warn(
      'Cloudflare not connected (no ~/.cloudflared/cert.pem and no cloudflare.apiToken). ' +
      'Starting tunnel from local credentials anyway; creating NEW hostnames needs an API token: ' +
      'nxcloudflare config set cloudflare.apiToken <token>'
    );
  }

  if (enableTunnel) {
    try {
      tunnelResult = await startTunnel(config);
      if (tunnelResult?.url) {
        logger.info(`Public URL: ${tunnelResult.url}`);
      }
    } catch (err) {
      logger.error(`Tunnel failed: ${err.message}`);
      if (options.requireTunnel) {
        await shutdown(1);
        return;
      }
      logger.warn('Continuing with local server only');
    }
  } else {
    logger.info('Tunnel skipped');
  }

  printBanner(config, tunnelResult);

  setupSignals();
  return { config, tunnelResult };
}

function buildStatus(config) {
  const tunnel = getTunnelInfo();
  return {
    server: {
      status: 'running',
      host: config.server.host,
      port: config.server.port,
      pid: process.pid
    },
    cloudflare: {
      status: tunnel.status,
      mode: tunnel.mode || config.cloudflare?.mode || null,
      url: tunnel.url,
      pid: tunnel.pid
    }
  };
}

function printBanner(config, tunnelResult) {
  const lines = [
    '',
    'NxCloudflare',
    '----------------------------',
    `Server      : RUNNING`,
    `Local       : http://${config.server.host}:${config.server.port}`,
    `Health      : http://${config.server.host}:${config.server.port}/health`
  ];

  if (tunnelResult && !tunnelResult.skipped) {
    lines.push('Cloudflare');
    lines.push('----------------------------');
    lines.push(`Tunnel      : ${tunnelResult.url ? 'CONNECTED' : 'RUNNING'}`);
    if (tunnelResult.mode) lines.push(`Mode        : ${tunnelResult.mode}`);
    if (tunnelResult.url) lines.push(`Public      : ${tunnelResult.url}`);
    if (config.cloudflare?.rootDomains?.length) {
      lines.push(`Root domain : ${config.cloudflare.rootDomains.join(', ')}`);
    }
  }

  lines.push('----------------------------');
  lines.push('Press Ctrl+C to stop');
  lines.push('');
  console.log(lines.join('\n'));
}

function setupSignals() {
  const onSignal = (signal) => {
    logger.info(`Received ${signal}`);
    shutdown(0);
  };
  process.once('SIGINT', () => onSignal('SIGINT'));
  process.once('SIGTERM', () => onSignal('SIGTERM'));
}

export async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    await stopTunnel();
  } catch (err) {
    logger.error(`Error stopping tunnel: ${err.message}`);
  }

  try {
    if (httpServer) await httpServer.close();
  } catch (err) {
    logger.error(`Error stopping server: ${err.message}`);
  }

  removePid(SERVER_PID_FILE);
  removePid(MASTER_PID_FILE);
  writeState({
    server: { status: 'stopped', pid: null },
    cloudflare: { status: 'stopped', pid: null }
  });

  logger.info('NxCloudflare stopped');
  process.exit(code);
}

// Direct run: npm start / node src/index.js
const isDirect = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/src/index.js');
if (isDirect) {
  startNxCloudflare().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
