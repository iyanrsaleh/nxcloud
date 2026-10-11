import { loadConfig, getConfigPath, setConfigValue } from '../config.js';
import { getTunnelInfo } from '../cloudflare/tunnel.js';
import { readLogTail } from './logs.js';
import {
  listRoutes,
  getRoute,
  createRoute,
  updateRoute,
  deleteRoute,
  getRoutesFilePath,
  pingRouteOrigin
} from './routes.js';
import { getManagedRootDomains } from '../cloudflare/dns.js';
import {
  isCloudflareLoggedIn,
  triggerCloudflaredLogin,
  getCertPath,
  getLoginState
} from '../cloudflare/auth.js';
import { hasApiToken } from '../cloudflare/api.js';

/**
 * Public config view — strip secrets / absolute credential paths noise.
 */
export function getPublicConfig() {
  const config = loadConfig();
  return {
    path: getConfigPath(),
    server: { ...config.server },
    cloudflare: {
      enabled: config.cloudflare.enabled,
      mode: config.cloudflare.mode,
      rootDomains: Array.isArray(config.cloudflare.rootDomains) ? config.cloudflare.rootDomains : [],
      tunnelName: config.cloudflare.tunnelName,
      service: config.cloudflare.service,
      cloudflaredConfig: config.cloudflare.cloudflaredConfig || null,
      apiTokenSet: hasApiToken()
    },
    logging: { ...config.logging },
    api: {
      allowControl: Boolean(config.api?.allowControl),
      controlTokenSet: Boolean(config.api?.controlToken)
    }
  };
}

export function getTunnelPayload(config) {
  const info = getTunnelInfo();
  return {
    enabled: config.cloudflare?.enabled !== false,
    running: info.running,
    status: info.status,
    mode: info.mode || config.cloudflare?.mode || null,
    url: info.url,
    pid: info.pid,
    service: config.cloudflare?.service || null
  };
}

/**
 * Read JSON body (empty object if none).
 */
export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error('Invalid JSON body');
    err.code = 'BAD_REQUEST';
    throw err;
  }
}

function mapRouteError(err) {
  if (err.code === 'BAD_REQUEST') return { status: 400, body: { error: err.message } };
  if (err.code === 'NOT_FOUND') return { status: 404, body: { error: err.message } };
  if (err.code === 'CONFLICT') return { status: 409, body: { error: err.message } };
  throw err;
}

function requireLoopbackWrite(loopback) {
  if (!loopback) {
    return {
      status: 403,
      body: { error: 'Route changes are localhost-only' }
    };
  }
  return null;
}

function requireLoopbackRead(loopback) {
  if (!loopback) {
    return {
      status: 403,
      body: { error: 'This endpoint is localhost-only' }
    };
  }
  return null;
}

/**
 * @param {object} ctx
 */
export async function handleApi(ctx) {
  const { req, url, getStatus, config, loopback, allowControl, onStop, onRestart } =
    ctx;
  const path = url.pathname;
  const method = req.method || 'GET';

  if (path === '/api' || path === '/api/') {
    return {
      status: 200,
      body: {
        service: 'NxCloudflare API',
        version: '0.2.0',
        endpoints: [
          'GET /api/health',
          'GET /api/status',
          'GET /api/auth/status',
          'POST /api/auth/login',
          'GET /api/config',
          'POST /api/config/root-domains',
          'DELETE /api/config/root-domains/:domain',
          'GET /api/tunnel',
          'GET /api/logs',
          'GET /api/routes',
          'GET /api/routes/:id',
          'POST /api/routes',
          'PATCH /api/routes/:id',
          'DELETE /api/routes/:id',
          'POST /api/routes/:id/ping',
          'GET /api/domains',
          'POST /api/control/stop',
          'POST /api/control/restart'
        ]
      }
    };
  }

  if (method === 'GET' && (path === '/api/health' || path === '/health')) {
    return {
      status: 200,
      body: { status: 'ok', service: 'NxCloudflare' }
    };
  }

  if (method === 'GET' && (path === '/api/status' || path === '/status')) {
    const routes = listRoutes();
    return {
      status: 200,
      body: {
        ...getStatus(),
        routes: {
          count: routes.count,
          enabledCount: routes.enabledCount
        }
      }
    };
  }

  if (method === 'GET' && path === '/api/config') {
    const denied = requireLoopbackRead(loopback);
    if (denied) return denied;
    return { status: 200, body: getPublicConfig() };
  }

  if (method === 'POST' && path === '/api/config/root-domains') {
    const denied = requireLoopbackWrite(loopback);
    if (denied) return denied;
    try {
      const body = await readJsonBody(req);
      const domain = String(body.rootDomain || '').trim().toLowerCase();
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
        return {
          status: 400,
          body: { error: 'rootDomain must look like a domain (e.g. example.com)' }
        };
      }
      const current = loadConfig().cloudflare.rootDomains || [];
      if (current.includes(domain)) {
        return { status: 409, body: { error: `"${domain}" is already managed` } };
      }
      setConfigValue('cloudflare.rootDomains', [...current, domain].join(','));
      return { status: 201, body: getPublicConfig() };
    } catch (err) {
      return { status: 400, body: { error: err.message } };
    }
  }

  const rootDomainMatch = path.match(/^\/api\/config\/root-domains\/([^/]+)$/);
  if (rootDomainMatch && method === 'DELETE') {
    const denied = requireLoopbackWrite(loopback);
    if (denied) return denied;
    const domain = decodeURIComponent(rootDomainMatch[1]).toLowerCase();
    const current = loadConfig().cloudflare.rootDomains || [];
    if (!current.includes(domain)) {
      return { status: 404, body: { error: `"${domain}" is not managed` } };
    }
    setConfigValue('cloudflare.rootDomains', current.filter((d) => d !== domain).join(','));
    return { status: 200, body: getPublicConfig() };
  }

  if (method === 'GET' && path === '/api/tunnel') {
    const denied = requireLoopbackRead(loopback);
    if (denied) return denied;
    return { status: 200, body: getTunnelPayload(config) };
  }

  // ---- Auth (Cloudflare account login state) ----
  if (method === 'GET' && path === '/api/auth/status') {
    const denied = requireLoopbackRead(loopback);
    if (denied) return denied;
    return {
      status: 200,
      body: {
        loggedIn: isCloudflareLoggedIn(),
        tokenSet: hasApiToken(),
        ready: isCloudflareLoggedIn() || hasApiToken(),
        certPath: getCertPath(),
        login: getLoginState()
      }
    };
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const denied = requireLoopbackWrite(loopback);
    if (denied) return denied;
    try {
      const result = await triggerCloudflaredLogin();
      return { status: 202, body: result };
    } catch (err) {
      return mapRouteError(err);
    }
  }

  if (method === 'GET' && path === '/api/logs') {
    const denied = requireLoopbackRead(loopback);
    if (denied) return denied;
    const source = url.searchParams.get('source') || 'server';
    const lines = url.searchParams.get('lines') || 40;
    try {
      return { status: 200, body: readLogTail(source, lines) };
    } catch (err) {
      if (err.code === 'BAD_REQUEST') {
        return { status: 400, body: { error: err.message } };
      }
      throw err;
    }
  }

  // ---- Routes (Pembelokan) ----
  if (method === 'GET' && path === '/api/routes') {
    const denied = requireLoopbackRead(loopback);
    if (denied) return denied;
    const data = listRoutes();
    return {
      status: 200,
      body: {
        ...data,
        file: getRoutesFilePath()
      }
    };
  }

  const pingMatch = path.match(/^\/api\/routes\/([^/]+)\/ping$/);
  if (pingMatch && method === 'POST') {
    const denied = requireLoopbackRead(loopback);
    if (denied) return denied;
    const id = decodeURIComponent(pingMatch[1]);
    try {
      return { status: 200, body: await pingRouteOrigin(id) };
    } catch (err) {
      return mapRouteError(err);
    }
  }

  const routeMatch = path.match(/^\/api\/routes\/([^/]+)$/);
  if (routeMatch) {
    const id = decodeURIComponent(routeMatch[1]);

    if (method === 'GET') {
      const denied = requireLoopbackRead(loopback);
      if (denied) return denied;
      try {
        return { status: 200, body: getRoute(id) };
      } catch (err) {
        return mapRouteError(err);
      }
    }

    if (method === 'PATCH') {
      const denied = requireLoopbackWrite(loopback);
      if (denied) return denied;
      try {
        const body = await readJsonBody(req);
        return { status: 200, body: updateRoute(id, body) };
      } catch (err) {
        return mapRouteError(err);
      }
    }

    if (method === 'DELETE') {
      const denied = requireLoopbackWrite(loopback);
      if (denied) return denied;
      try {
        return { status: 200, body: deleteRoute(id) };
      } catch (err) {
        return mapRouteError(err);
      }
    }
  }

  if (method === 'POST' && path === '/api/routes') {
    const denied = requireLoopbackWrite(loopback);
    if (denied) return denied;
    try {
      const body = await readJsonBody(req);
      return { status: 201, body: await createRoute(body) };
    } catch (err) {
      return mapRouteError(err);
    }
  }

  // ---- Domains (info ringkas: root domain yang dikelola) ----
  if (method === 'GET' && path === '/api/domains') {
    const denied = requireLoopbackRead(loopback);
    if (denied) return denied;
    return {
      status: 200,
      body: {
        rootDomains: getManagedRootDomains()
      }
    };
  }

  if (method === 'POST' && path === '/api/control/stop') {
    return handleControl({
      action: 'stop',
      loopback,
      allowControl,
      req,
      config,
      run: onStop
    });
  }

  if (method === 'POST' && path === '/api/control/restart') {
    return handleControl({
      action: 'restart',
      loopback,
      allowControl,
      req,
      config,
      run: onRestart
    });
  }

  return { status: 404, body: { error: 'Not Found' } };
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function handleControl({ action, loopback, allowControl, req, config, run }) {
  if (!loopback) {
    return {
      status: 403,
      body: { error: 'Control API is localhost-only' }
    };
  }
  if (!allowControl) {
    return {
      status: 403,
      body: {
        error:
          'Control API disabled. Set api.allowControl=true in config (localhost only).'
      }
    };
  }
  const expectedToken = config?.api?.controlToken;
  if (expectedToken) {
    const provided = req.headers['x-nx-token'];
    if (typeof provided !== 'string' || !timingSafeEqual(provided, expectedToken)) {
      return {
        status: 401,
        body: { error: 'Missing or invalid X-Nx-Token header' }
      };
    }
  }
  if (typeof run !== 'function') {
    return {
      status: 501,
      body: { error: `Control action "${action}" is not available` }
    };
  }

  setTimeout(() => {
    Promise.resolve()
      .then(() => run())
      .catch(() => {});
  }, 50);

  return {
    status: 202,
    body: { accepted: true, action }
  };
}
