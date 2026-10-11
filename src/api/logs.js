import fs from 'node:fs';
import { SERVER_LOG, TUNNEL_LOG, ERROR_LOG } from '../utils/paths.js';

const LOG_FILES = {
  server: SERVER_LOG,
  tunnel: TUNNEL_LOG,
  error: ERROR_LOG
};

/**
 * @param {'server'|'tunnel'|'error'} source
 * @param {number} maxLines
 */
export function readLogTail(source = 'server', maxLines = 40) {
  const key = String(source || 'server').toLowerCase();
  const filePath = LOG_FILES[key];
  if (!filePath) {
    const err = new Error(`Invalid log source: ${source}. Use server|tunnel|error`);
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const lines = Math.min(Math.max(Number(maxLines) || 40, 1), 500);

  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const parts = text.split(/\r?\n/).filter((l) => l.length > 0);
    return {
      source: key,
      file: filePath,
      lines: parts.slice(-lines)
    };
  } catch {
    return {
      source: key,
      file: filePath,
      lines: []
    };
  }
}
