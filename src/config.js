import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE, ROOT_DIR } from './utils/paths.js';
import { isWindows } from './utils/platform.js';

const DEFAULTS = {
  server: {
    host: '127.0.0.1',
    port: 8787
  },
  cloudflare: {
    enabled: true,
    mode: 'quick',
    rootDomains: [],
    tunnelName: 'nxcloud',
    service: 'http://127.0.0.1:8787',
    credentialsFile: '',
    cloudflaredConfig: '.credentials/config.yml',
    apiToken: ''
  },
  logging: {
    level: 'INFO'
  },
  api: {
    allowControl: false,
    controlToken: ''
  }
};

/** Allowed dotted keys for `config set` */
export const CONFIG_KEYS = [
  'server.host',
  'server.port',
  'cloudflare.enabled',
  'cloudflare.mode',
  'cloudflare.rootDomains',
  'cloudflare.service',
  'cloudflare.tunnelName',
  'cloudflare.credentialsFile',
  'cloudflare.cloudflaredConfig',
  'cloudflare.apiToken',
  'logging.level',
  'api.allowControl',
  'api.controlToken'
];

function deepMerge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      out[key] = deepMerge(base[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function readRaw(configPath = CONFIG_FILE) {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`Invalid config at ${configPath}: ${err.message}`);
  }
}

export function loadConfig(configPath = CONFIG_FILE) {
  const raw = readRaw(configPath);
  const config = deepMerge(DEFAULTS, raw);

  if (!raw?.cloudflare?.service) {
    config.cloudflare.service = `http://${config.server.host}:${config.server.port}`;
  }

  validateConfig(config);
  return config;
}

export function validateConfig(config) {
  const errors = [];

  if (!config.server?.host) errors.push('server.host is required');
  if (!Number.isInteger(config.server?.port) || config.server.port < 1 || config.server.port > 65535) {
    errors.push('server.port must be an integer 1-65535');
  }

  const mode = config.cloudflare?.mode;
  if (mode && !['quick', 'named'].includes(mode)) {
    errors.push('cloudflare.mode must be "quick" or "named"');
  }

  if (config.cloudflare?.enabled && mode === 'named') {
    if (!Array.isArray(config.cloudflare.rootDomains) || config.cloudflare.rootDomains.length === 0) {
      errors.push('cloudflare.rootDomains must have at least one domain when mode is "named"');
    }
  }

  const level = (config.logging?.level || 'INFO').toUpperCase();
  if (!['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(level)) {
    errors.push('logging.level must be DEBUG, INFO, WARN, or ERROR');
  }
  config.logging.level = level;

  if (typeof config.cloudflare.enabled === 'string') {
    config.cloudflare.enabled = parseBool(config.cloudflare.enabled);
  }

  if (errors.length) {
    throw new Error(`Config validation failed:\n- ${errors.join('\n- ')}`);
  }

  return config;
}

export function getConfigPath() {
  return CONFIG_FILE;
}

export function getByPath(obj, dotted) {
  return dotted.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function setByPath(obj, dotted, value) {
  const parts = dotted.split('.');
  const last = parts.pop();
  let cur = obj;
  for (const part of parts) {
    if (typeof cur[part] !== 'object' || cur[part] === null) {
      cur[part] = {};
    }
    cur = cur[part];
  }
  cur[last] = value;
  return obj;
}

function parseBool(value) {
  const s = String(value).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  throw new Error(`Invalid boolean: ${value}`);
}

export function coerceConfigValue(key, raw) {
  if (key === 'server.port') {
    const n = Number(raw);
    if (!Number.isInteger(n)) throw new Error('server.port must be an integer');
    return n;
  }
  if (key === 'cloudflare.enabled' || key === 'api.allowControl') {
    return parseBool(raw);
  }
  if (key === 'logging.level') {
    return String(raw).toUpperCase();
  }
  if (key === 'cloudflare.mode') {
    return String(raw).toLowerCase();
  }
  if (key === 'cloudflare.rootDomains') {
    return String(raw)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return String(raw);
}

/**
 * Persist a single dotted key into the config file (merge with existing raw file).
 */
export function setConfigValue(key, rawValue, configPath = CONFIG_FILE) {
  if (!CONFIG_KEYS.includes(key)) {
    throw new Error(
      `Unknown key "${key}". Allowed:\n  ${CONFIG_KEYS.join('\n  ')}`
    );
  }

  const value = coerceConfigValue(key, rawValue);
  const raw = readRaw(configPath);
  setByPath(raw, key, value);

  // Keep service aligned when host/port change and service was auto/default
  if (key === 'server.host' || key === 'server.port') {
    const merged = deepMerge(DEFAULTS, raw);
    const autoService = `http://${merged.server.host}:${merged.server.port}`;
    if (!raw.cloudflare?.service || String(raw.cloudflare.service).includes('127.0.0.1')) {
      setByPath(raw, 'cloudflare.service', autoService);
    }
  }

  const next = deepMerge(DEFAULTS, raw);
  validateConfig(next);

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  return loadConfig(configPath);
}

export function getLocalCloudflaredPath() {
  const binary = isWindows() ? 'cloudflared.exe' : 'cloudflared';
  return path.join(ROOT_DIR, '.tools', binary);
}
