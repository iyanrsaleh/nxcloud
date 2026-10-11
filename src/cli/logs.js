import fs from 'node:fs';
import { SERVER_LOG, TUNNEL_LOG, ERROR_LOG, LOGS_DIR } from '../utils/paths.js';

export async function logsCommand(args = []) {
  const which = (args[0] || 'server').toLowerCase();
  const lines = Number(args.find((a) => /^\d+$/.test(a)) || 40);

  const map = {
    server: SERVER_LOG,
    tunnel: TUNNEL_LOG,
    error: ERROR_LOG,
    all: null
  };

  if (!(which in map) && which !== 'all') {
    console.log('Usage: nxcloud logs [server|tunnel|error|all] [lines]');
    return 1;
  }

  if (which === 'all') {
    printTail('server', SERVER_LOG, lines);
    printTail('tunnel', TUNNEL_LOG, lines);
    printTail('error', ERROR_LOG, lines);
    return 0;
  }

  printTail(which, map[which], lines);
  return 0;
}

function printTail(label, filePath, maxLines) {
  console.log(`\n--- ${label} (${filePath}) ---`);
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const parts = text.split(/\r?\n/).filter((l) => l.length > 0);
    const slice = parts.slice(-maxLines);
    console.log(slice.join('\n') || '(empty)');
  } catch {
    console.log(`(no log yet — ${LOGS_DIR})`);
  }
}
