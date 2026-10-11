import http from 'node:http';
import { logger } from './logger.js';
import { handleApi } from './api/router.js';
import { loadConfig } from './config.js';

/**
 * @param {object} options
 * @param {string} options.host
 * @param {number} options.port
 * @param {() => object} options.getStatus
 * @param {() => Promise<void>} [options.onStop]
 * @param {() => Promise<void>} [options.onRestart]
 */
export function createServer({ host, port, getStatus, onStop, onRestart }) {
  const server = http.createServer((req, res) => {
    handleRequest(req, res, { getStatus, onStop, onRestart }).catch((err) => {
      logger.error(`Request error: ${err.message}`);
      sendJson(res, 500, { error: 'Internal Server Error' });
    });
  });

  let shuttingDown = false;

  async function listen() {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.removeListener('error', reject);
        logger.info(`Server listening on http://${host}:${port}`);
        resolve();
      });
    });
  }

  async function close() {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Server shutting down...');
    await new Promise((resolve) => {
      server.close(() => resolve());
      setTimeout(() => resolve(), 3000).unref?.();
    });
    logger.info('Server stopped');
  }

  return { server, listen, close };
}

async function handleRequest(req, res, hooks) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  applyCors(req, res);
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const config = loadConfig();
  const loopback = isLoopback(req);
  const allowControl = Boolean(config.api?.allowControl);

  // Legacy + API routes handled by API router when under /api or known paths
  if (
    path === '/api' ||
    path.startsWith('/api/') ||
    path === '/health' ||
    path === '/status'
  ) {
    const result = await handleApi({
      req,
      url,
      getStatus: hooks.getStatus,
      config,
      loopback,
      allowControl,
      onStop: hooks.onStop,
      onRestart: hooks.onRestart
    });
    sendJson(res, result.status, result.body);
    return;
  }

  if (method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (path === '/' || path === '') {
    sendJson(res, 200, {
      service: 'NxCloudflare',
      message: 'Local Node.js server with Cloudflare Tunnel',
      endpoints: [
        '/',
        '/health',
        '/status',
        '/api',
        '/api/health',
        '/api/status',
        '/api/config',
        '/api/tunnel',
        '/api/routes',
        '/api/control/stop',
        '/api/control/restart'
      ]
    });
    return;
  }

  sendJson(res, 404, { error: 'Not Found' });
}

function isLoopback(req) {
  const raw = req.socket?.remoteAddress || '';
  const ip = raw.replace(/^::ffff:/, '');
  const isSocketLoopback = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
  if (!isSocketLoopback) return false;

  // cloudflared forwards tunnel traffic to 127.0.0.1, so the socket alone
  // cannot distinguish real local requests from public requests via the
  // tunnel. Cloudflare always adds these headers for tunneled requests.
  if (req.headers['cf-connecting-ip'] || req.headers['cf-ray']) return false;

  return true;
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  // Desktop (localhost:7800) + same-origin tools
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}
