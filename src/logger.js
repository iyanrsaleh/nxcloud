import fs from 'node:fs';
import { ensureDir } from './utils/process.js';
import { LOGS_DIR, SERVER_LOG, ERROR_LOG, TUNNEL_LOG } from './utils/paths.js';

const LEVELS = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40
};

let currentLevel = LEVELS.INFO;

function timestamp() {
  return new Date().toISOString();
}

function format(level, message) {
  return `[${timestamp()}] [${level}] ${message}`;
}

function appendFile(filePath, line) {
  try {
    ensureDir(LOGS_DIR);
    fs.appendFileSync(filePath, `${line}\n`, 'utf8');
  } catch {
    // avoid recursive logging failures
  }
}

function write(level, message, toErrorLog = false) {
  if (LEVELS[level] < currentLevel) return;
  const line = format(level, message);
  const stream = level === 'ERROR' ? console.error : console.log;
  stream(line);
  appendFile(SERVER_LOG, line);
  if (toErrorLog || level === 'ERROR') {
    appendFile(ERROR_LOG, line);
  }
}

export function setLogLevel(level) {
  const key = String(level || 'INFO').toUpperCase();
  currentLevel = LEVELS[key] ?? LEVELS.INFO;
}

export const logger = {
  debug: (msg) => write('DEBUG', msg),
  info: (msg) => write('INFO', msg),
  warn: (msg) => write('WARN', msg),
  error: (msg) => write('ERROR', msg, true)
};

export function appendTunnelLog(line) {
  appendFile(TUNNEL_LOG, line);
}
