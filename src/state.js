import fs from 'node:fs';
import { ensureDir } from './utils/process.js';
import { RUNTIME_DIR, STATE_FILE } from './utils/paths.js';

const defaultState = () => ({
  server: {
    status: 'stopped',
    host: null,
    port: null,
    pid: null,
    startedAt: null
  },
  cloudflare: {
    status: 'stopped',
    mode: null,
    url: null,
    hostname: null,
    pid: null,
    startedAt: null
  }
});

export function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

export function writeState(partial) {
  ensureDir(RUNTIME_DIR);
  const current = readState();
  const next = {
    server: { ...current.server, ...(partial.server || {}) },
    cloudflare: { ...current.cloudflare, ...(partial.cloudflare || {}) }
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function clearState() {
  try {
    fs.unlinkSync(STATE_FILE);
  } catch {
    // ignore
  }
}
