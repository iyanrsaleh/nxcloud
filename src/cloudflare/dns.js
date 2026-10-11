import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { findCloudflared } from './process.js';
import { loadConfig } from '../config.js';
import { hasApiToken, resolveTunnelTarget, createCnameRecord } from './api.js';

const execFileAsync = promisify(execFile);

/**
 * Root domains this NxCloudflare instance is allowed to manage DNS for,
 * set explicitly via `cloudflare.rootDomains` config. `cloudflared tunnel
 * route dns` accepts ANY hostname string and will happily create a CNAME
 * for it under whatever zone matches in the account, with no validation
 * and no way to undo from the CLI (see Plan-domain-onboarding.md §5.4
 * incident) — so NxCloudflare enforces its own allow-list before ever
 * calling it.
 */
export function getManagedRootDomains() {
  const config = loadConfig();
  const list = Array.isArray(config.cloudflare?.rootDomains) ? config.cloudflare.rootDomains : [];
  return list.map((d) => String(d || '').trim().toLowerCase()).filter(Boolean);
}

/**
 * Which managed root domain `hostname` belongs to, or null if none match.
 */
export function matchRootDomain(hostname) {
  const h = String(hostname || '').trim().toLowerCase();
  return getManagedRootDomains().find((root) => h === root || h.endsWith(`.${root}`)) || null;
}

/**
 * Reject anything that isn't a subdomain of a managed root domain.
 * Throws a BAD_REQUEST-coded error on rejection; returns nothing on success.
 */
export function assertHostnameIsManaged(hostname) {
  const roots = getManagedRootDomains();
  if (!roots.length) {
    const err = new Error(
      'No managed root domain configured (cloudflare.rootDomains is empty) — cannot verify DNS ownership'
    );
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (!matchRootDomain(hostname)) {
    const err = new Error(
      `Refusing to create DNS for "${hostname}" — not a subdomain of any managed domain (${roots.join(', ')})`
    );
    err.code = 'BAD_REQUEST';
    throw err;
  }
}

/**
 * Create a DNS CNAME route for `hostname` pointing at `tunnelName`.
 * Validates hostname against the managed root domain FIRST — never calls
 * cloudflared with an unvalidated hostname.
 */
export async function addDnsRoute(hostname) {
  assertHostnameIsManaged(hostname);

  const config = loadConfig();
  const tunnelName = config.cloudflare?.tunnelName;
  if (!tunnelName) {
    const err = new Error('cloudflare.tunnelName is not configured');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Jalur API token (REST) — tidak butuh cert.pem. Dipilih lebih dulu karena
  // `cloudflared tunnel login` rusak di sebagian akun (cloudflared#1252),
  // sedangkan `tunnel route dns` (CLI) selalu butuh cert.
  if (hasApiToken()) {
    const zoneName = matchRootDomain(hostname);
    try {
      const target = resolveTunnelTarget(config);
      const result = await createCnameRecord({ zoneName, hostname, target });
      return {
        hostname,
        tunnelName,
        via: 'api-token',
        created: result.created,
        alreadyExisted: result.alreadyExisted,
        output: result.created
          ? `CNAME ${hostname} -> ${target}`
          : `already configured: ${hostname}`
      };
    } catch (err) {
      return {
        hostname,
        tunnelName,
        via: 'api-token',
        created: false,
        alreadyExisted: false,
        error: err.message,
        output: err.message
      };
    }
  }

  const binary = await findCloudflared();
  if (!binary) {
    const err = new Error('cloudflared not found on PATH or .tools/');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  try {
    const { stdout, stderr } = await execFileAsync(binary, [
      'tunnel',
      'route',
      'dns',
      tunnelName,
      hostname
    ]);
    const output = `${stdout || ''}${stderr || ''}`;
    const alreadyExists = /already configured/i.test(output);
    return {
      hostname,
      tunnelName,
      via: 'cert',
      created: !alreadyExists,
      alreadyExisted: alreadyExists,
      output: output.trim()
    };
  } catch (err) {
    const detail = `${err.stderr || ''}`.trim() || err.message;
    return {
      hostname,
      tunnelName,
      via: 'cert',
      created: false,
      alreadyExisted: false,
      error: /certificate|cert\.pem|not logged in/i.test(detail)
        ? `${detail} — isi API token untuk jalur alternatif: nxcloudflare config set cloudflare.apiToken <token>`
        : err.message,
      output: `${err.stdout || ''}${err.stderr || ''}`.trim()
    };
  }
}
