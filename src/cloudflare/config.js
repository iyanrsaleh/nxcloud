import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../utils/paths.js';

/**
 * Resolve a path that may be relative to project root.
 */
export function resolveProjectPath(filePath) {
  if (!filePath) return null;
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT_DIR, filePath);
}

/**
 * Build cloudflared arguments from NxCloudflare config.
 */
export function buildTunnelArgs(config) {
  const cf = config.cloudflare || {};
  const service = cf.service || `http://${config.server.host}:${config.server.port}`;
  const mode = cf.mode || 'quick';

  if (mode === 'quick') {
    return {
      mode: 'quick',
      args: ['tunnel', '--url', service]
    };
  }

  const configPath = resolveProjectPath(cf.cloudflaredConfig || '.credentials/config.yml');
  if (!configPath || !fs.existsSync(configPath)) {
    throw new Error(
      `Named tunnel requires cloudflared config file. Create it from .credentials/config.yml.example → ${cf.cloudflaredConfig || '.credentials/config.yml'}`
    );
  }

  // Prefer explicit config file so hostname routing is controlled locally.
  return {
    mode: 'named',
    args: ['tunnel', '--config', configPath, 'run'],
    configPath
  };
}

export function resolveServiceUrl(config) {
  return (
    config.cloudflare?.service ||
    `http://${config.server.host}:${config.server.port}`
  );
}

export function resolvePublicUrl(config, tunnelResult = {}) {
  return tunnelResult.url || null;
}
