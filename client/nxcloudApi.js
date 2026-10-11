/** nxcloud API client. Synced copy lives at Desktop/lib/nxcloudApi.js — update here, then copy over. */

function resolveBase(explicit) {
  if (explicit) return String(explicit).replace(/\/$/, '');
  const fromNexa =
    globalThis.NEXA && globalThis.NEXA.nxcloudApi
      ? globalThis.NEXA.nxcloudApi
      : null;
  return String(fromNexa || 'http://127.0.0.1:8787').replace(/\/$/, '');
}

async function request(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export function createnxcloudApi(baseUrl, opts = {}) {
  const base = resolveBase(baseUrl);
  const controlToken = opts.controlToken || null;
  const withToken = (init = {}) => ({
    ...init,
    headers: {
      ...(controlToken ? { 'X-Nx-Token': controlToken } : {}),
      ...(init.headers || {})
    }
  });
  return {
    baseUrl: base,
    getHealth: () => request(base, '/api/health'),
    getStatus: () => request(base, '/api/status'),
    getConfig: () => request(base, '/api/config'),
    addRootDomain: (rootDomain) =>
      request(base, '/api/config/root-domains', {
        method: 'POST',
        body: JSON.stringify({ rootDomain })
      }),
    removeRootDomain: (rootDomain) =>
      request(base, `/api/config/root-domains/${encodeURIComponent(rootDomain)}`, {
        method: 'DELETE'
      }),
    getTunnel: () => request(base, '/api/tunnel'),
    getLogs: (opts = {}) => {
      const q = new URLSearchParams({
        source: String(opts.source || 'server'),
        lines: String(opts.lines || 40)
      });
      return request(base, `/api/logs?${q}`);
    },
    listRoutes: () => request(base, '/api/routes'),
    getRoute: (id) => request(base, `/api/routes/${encodeURIComponent(id)}`),
    createRoute: (body) =>
      request(base, '/api/routes', { method: 'POST', body: JSON.stringify(body) }),
    updateRoute: (id, body) =>
      request(base, `/api/routes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      }),
    deleteRoute: (id) =>
      request(base, `/api/routes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    pingRoute: (id) =>
      request(base, `/api/routes/${encodeURIComponent(id)}/ping`, { method: 'POST' }),
    getAuthStatus: () => request(base, '/api/auth/status'),
    triggerLogin: () => request(base, '/api/auth/login', { method: 'POST' }),
    getDomains: () => request(base, '/api/domains'),
    stop: () => request(base, '/api/control/stop', withToken({ method: 'POST' })),
    restart: () => request(base, '/api/control/restart', withToken({ method: 'POST' }))
  };
}

export const nx = createnxcloudApi();
export default nx;
