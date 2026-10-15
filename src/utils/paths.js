import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSea } from 'node:sea';

function sourcePackageRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..', '..');
}

/**
 * Version reported by the API/CLI. Prefer a build-time injected constant (SEA
 * builds replace it via esbuild `define`, since package.json is not next to a
 * standalone exe); otherwise read package.json from the source tree. Read from
 * one place so it can never drift from what was actually built — it previously
 * was a hardcoded string that disagreed with package.json.
 */
export function getVersion() {
  if (typeof __NXCLOUD_VERSION__ === 'string' && __NXCLOUD_VERSION__) {
    return __NXCLOUD_VERSION__;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(sourcePackageRoot(), 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Root of the nxcloud project.
 * Source mode (`node src/index.js` / `npm link`): folder proyek.
 * SEA mode (dist/nxcloud.exe): folder tempat .exe berada, supaya
 * config/logs/.runtime/.credentials tetap portable di sebelah .exe.
 */
export const ROOT_DIR = isSea() ? path.dirname(process.execPath) : sourcePackageRoot();

export const CONFIG_DIR = path.join(ROOT_DIR, 'config');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'nxcloud.json');
export const ROUTES_FILE = path.join(CONFIG_DIR, 'routes.json');
export const LOGS_DIR = path.join(ROOT_DIR, 'logs');
export const RUNTIME_DIR = path.join(ROOT_DIR, '.runtime');

export const SERVER_PID_FILE = path.join(RUNTIME_DIR, 'server.pid');
export const TUNNEL_PID_FILE = path.join(RUNTIME_DIR, 'tunnel.pid');
export const MASTER_PID_FILE = path.join(RUNTIME_DIR, 'nxcloud.pid');
export const STATE_FILE = path.join(RUNTIME_DIR, 'state.json');

export const SERVER_LOG = path.join(LOGS_DIR, 'server.log');
export const TUNNEL_LOG = path.join(LOGS_DIR, 'tunnel.log');
export const ERROR_LOG = path.join(LOGS_DIR, 'error.log');
