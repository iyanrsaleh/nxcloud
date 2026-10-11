import fs from 'node:fs';
import { loadConfig } from '../config.js';
import { resolveProjectPath } from './config.js';

const API_BASE = 'https://api.cloudflare.com/client/v4';

/**
 * API token Cloudflare dari config (`cloudflare.apiToken`), atau null.
 *
 * Jalur alternatif untuk manajemen DNS tanpa `cert.pem`: `cloudflared
 * tunnel login` rusak di sebagian akun (cloudflare/cloudflared#1252 —
 * approve di browser tidak pernah tercatat, selalu "Failed to fetch
 * resource"), padahal tunnel sendiri tetap bisa jalan dari file
 * kredensial lokal. Token dipakai hanya untuk membuat CNAME via REST.
 */
export function getApiToken() {
  const config = loadConfig();
  return String(config.cloudflare?.apiToken || '').trim() || null;
}

export function hasApiToken() {
  return Boolean(getApiToken());
}

async function cfFetch(path, { method = 'GET', body } = {}) {
  const token = getApiToken();
  if (!token) {
    const err = new Error(
      'cloudflare.apiToken belum diisi — jalankan: nxcloudflare config set cloudflare.apiToken <token>'
    );
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok || !data?.success) {
    const messages = Array.isArray(data?.errors)
      ? data.errors.map((e) => e?.message).filter(Boolean)
      : [];
    const err = new Error(messages.join('; ') || `Cloudflare API HTTP ${res.status}`);
    err.code = res.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST';
    err.status = res.status;
    throw err;
  }

  return data.result;
}

/**
 * Zone ID untuk `zoneName` (butuh izin Zone:Read pada token).
 */
export async function findZoneId(zoneName) {
  const zones = await cfFetch(`/zones?name=${encodeURIComponent(zoneName)}&status=active`);
  if (!Array.isArray(zones) || !zones.length) {
    const err = new Error(
      `Zona "${zoneName}" tidak ditemukan di akun Cloudflare (butuh izin Zone:Read)`
    );
    err.code = 'NOT_FOUND';
    throw err;
  }
  return zones[0].id;
}

/**
 * Target CNAME tunnel: UUID dari `cloudflaredConfig` bila ada (dipakai
 * Cloudflare untuk `cfargotunnel.com`), fallback ke nama tunnel.
 */
export function resolveTunnelTarget(config = loadConfig()) {
  const configPath = resolveProjectPath(
    config.cloudflare?.cloudflaredConfig || '.credentials/config.yml'
  );
  if (configPath && fs.existsSync(configPath)) {
    const match = fs.readFileSync(configPath, 'utf8').match(/^\s*tunnel:\s*([0-9a-fA-F-]{36})\s*$/m);
    if (match) return `${match[1]}.cfargotunnel.com`;
  }
  return `${config.cloudflare?.tunnelName || 'tunnel'}.cfargotunnel.com`;
}

/**
 * Buat (atau deteksi sudah ada) CNAME `hostname` → tunnel.
 * Butuh izin Zone:DNS:Edit pada token.
 */
export async function createCnameRecord({ zoneName, hostname, target }) {
  const zoneId = await findZoneId(zoneName);

  const existing = await cfFetch(
    `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`
  );
  if (Array.isArray(existing) && existing.length) {
    return { created: false, alreadyExisted: true, zoneId, record: existing[0] };
  }

  const record = await cfFetch(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: {
      type: 'CNAME',
      name: hostname,
      content: target,
      proxied: true,
      ttl: 1
    }
  });

  return { created: true, alreadyExisted: false, zoneId, record };
}
