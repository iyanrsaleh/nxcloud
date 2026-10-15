import fs from 'node:fs';
import path from 'node:path';
import { ROUTES_FILE, CONFIG_DIR } from '../utils/paths.js';
import { loadConfig } from '../config.js';
import { resolveProjectPath } from '../cloudflare/config.js';
import { addDnsRoute, assertHostnameIsManaged } from '../cloudflare/dns.js';

function ensureStore() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(ROUTES_FILE)) {
    writeAll({ routes: [] });
  }
}


function readAll() {
  ensureStore();
  try {
    const raw = JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8'));
    return {
      routes: Array.isArray(raw.routes) ? raw.routes.map(normalizeRoute) : [],
      updatedAt: raw.updatedAt || null
    };
  } catch {
    const seed = defaultRoutesFromConfig();
    writeAll(seed);
    return seed;
  }
}

function writeAll(data) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const payload = {
    routes: (data.routes || []).map(normalizeRoute),
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(ROUTES_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

export function detectKind(origin) {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    const config = loadConfig();
    const selfPort = String(config.server.port);
    const selfHost = (config.server.host || '127.0.0.1').toLowerCase();
    if (
      (host === '127.0.0.1' || host === 'localhost') &&
      port === selfPort &&
      (selfHost === '127.0.0.1' || selfHost === 'localhost' || selfHost === host)
    ) {
      return 'internal';
    }
    return 'external';
  } catch {
    return 'external';
  }
}

export function normalizeRoute(input = {}) {
  const origin = String(input.origin || '').trim().replace(/\/$/, '');
  const hostname = String(input.hostname || '')
    .trim()
    .toLowerCase();
  const id =
    String(input.id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-') || slugFromHostname(hostname);

  return {
    id,
    name: String(input.name || hostname || id).trim(),
    hostname,
    origin,
    kind: input.kind === 'internal' || input.kind === 'external'
      ? input.kind
      : detectKind(origin),
    enabled: input.enabled !== false,
    publicUrl: hostname ? `https://${hostname}` : null,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function slugFromHostname(hostname) {
  if (!hostname) return `route-${Date.now()}`;
  return hostname.split('.')[0].replace(/[^a-z0-9-_]/gi, '-') || `route-${Date.now()}`;
}

export function listRoutes() {
  const data = readAll();
  return {
    count: data.routes.length,
    enabledCount: data.routes.filter((r) => r.enabled).length,
    updatedAt: data.updatedAt,
    routes: data.routes
  };
}

export function getRoute(id) {
  const found = readAll().routes.find((r) => r.id === id);
  if (!found) {
    const err = new Error(`Route not found: ${id}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  return found;
}

/**
 * Ping a route's origin from the server side (avoids browser CORS issues).
 */
export async function pingRouteOrigin(id, { timeoutMs = 5000 } = {}) {
  const route = getRoute(id);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(route.origin, { signal: controller.signal });
    return {
      id,
      origin: route.origin,
      reachable: true,
      status: res.status,
      durationMs: Date.now() - started
    };
  } catch (err) {
    return {
      id,
      origin: route.origin,
      reachable: false,
      error: err.name === 'AbortError' ? 'timeout' : err.message,
      durationMs: Date.now() - started
    };
  } finally {
    clearTimeout(timer);
  }
}

function assertValidRoute(route, { others = [] } = {}) {
  if (!route.name) {
    const err = new Error('name is required');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (!route.hostname || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(route.hostname)) {
    const err = new Error('hostname must look like a domain (e.g. app.example.com)');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  try {
    const u = new URL(route.origin);
    if (!/^https?:$/i.test(u.protocol)) throw new Error('bad protocol');
  } catch {
    const err = new Error('origin must be http(s) URL (e.g. http://127.0.0.1:7080)');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (others.some((r) => r.id !== route.id && r.hostname === route.hostname)) {
    const err = new Error(`hostname already used: ${route.hostname}`);
    err.code = 'CONFLICT';
    throw err;
  }
  if (others.some((r) => r.id !== route.id && r.id === route.id)) {
    const err = new Error(`id already used: ${route.id}`);
    err.code = 'CONFLICT';
    throw err;
  }
}

export async function createRoute(body) {
  const data = readAll();
  const route = normalizeRoute(body);
  if (data.routes.some((r) => r.id === route.id)) {
    const err = new Error(`id already used: ${route.id}`);
    err.code = 'CONFLICT';
    throw err;
  }
  assertValidRoute(route, { others: data.routes });

  // Validate + create DNS FIRST — never write the route to disk before we
  // know the hostname is allowed and cloudflared has been asked to route it
  // (see Plan-domain-onboarding.md §5.4: writing data before DNS validation
  // left an orphaned instance on disk when validation failed).
  assertHostnameIsManaged(route.hostname);
  const dns = await addDnsRoute(route.hostname);

  data.routes.push(route);
  writeAll(data);
  const sync = syncCloudflaredIngress(data.routes);
  return { route, dns, sync };
}

export function updateRoute(id, body) {
  const data = readAll();
  const idx = data.routes.findIndex((r) => r.id === id);
  if (idx === -1) {
    const err = new Error(`Route not found: ${id}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  const prev = data.routes[idx];
  const route = normalizeRoute({
    ...prev,
    ...body,
    id: prev.id,
    createdAt: prev.createdAt
  });
  assertValidRoute(route, { others: data.routes });
  data.routes[idx] = route;
  writeAll(data);
  const sync = syncCloudflaredIngress(data.routes);
  return { route, sync };
}

export function deleteRoute(id) {
  const data = readAll();
  const idx = data.routes.findIndex((r) => r.id === id);
  if (idx === -1) {
    const err = new Error(`Route not found: ${id}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  const [removed] = data.routes.splice(idx, 1);
  writeAll(data);
  const sync = syncCloudflaredIngress(data.routes);
  return { deleted: true, route: removed, sync };
}

/**
 * Render the cloudflared ingress block text for a set of routes. Pure (no file
 * or config access) so it can be tested without touching the real store; the
 * writer below reuses it. Always ends with the catch-all 404 service.
 */
export function renderIngress(routes) {
  const enabledRoutes = (routes || []).filter((r) => r.enabled && r.hostname);
  const ingressLines = ['ingress:'];
  for (const r of enabledRoutes) {
    ingressLines.push(`  - hostname: ${r.hostname}`);
    ingressLines.push(`    service: ${r.origin}`);
  }
  ingressLines.push('  - service: http_status:404');
  ingressLines.push('');
  return { text: ingressLines.join('\n'), hostnames: enabledRoutes.map((r) => r.hostname) };
}

/**
 * Replace the ingress block in an existing cloudflared config file body,
 * preserving everything before it. Pure string transform.
 */
export function applyIngressToConfig(configText, ingressText) {
  const text = String(configText || '');
  if (/(\r?\n)ingress:[\s\S]*$/m.test(text) || /^ingress:/m.test(text)) {
    return text.replace(/(^|\r?\n)ingress:[\s\S]*$/m, `$1${ingressText}`);
  }
  return `${text.trimEnd()}\n\n${ingressText}`;
}

/**
 * Rewrite cloudflared config ingress from enabled routes — this is the
 * single place that writes the ingress block.
 * Tunnel process must be restarted to apply.
 */
export function syncCloudflaredIngress(routes) {
  const config = loadConfig();
  const configPath = resolveProjectPath(
    config.cloudflare?.cloudflaredConfig || '.credentials/config.yml'
  );
  if (!configPath || !fs.existsSync(configPath)) {
    return {
      written: false,
      reason: 'cloudflared config.yml not found',
      path: configPath
    };
  }

  const { text: ingressText, hostnames } = renderIngress(routes || readAll().routes);
  const text = applyIngressToConfig(fs.readFileSync(configPath, 'utf8'), ingressText);
  fs.writeFileSync(configPath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  return {
    written: true,
    path: configPath,
    hostnames,
    note: 'Restart nxcloud (tunnel) to apply ingress changes. Add DNS CNAME per hostname if missing.'
  };
}

export function getRoutesFilePath() {
  return ROUTES_FILE;
}
