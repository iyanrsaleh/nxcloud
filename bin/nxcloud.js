#!/usr/bin/env node
import { printHelp } from '../src/cli/help.js';
import { startCommand } from '../src/cli/start.js';
import { stopCommand } from '../src/cli/stop.js';
import { statusCommand } from '../src/cli/status.js';
import { tunnelCommand } from '../src/cli/tunnel.js';
import { configCommand } from '../src/cli/config.js';
import { logsCommand } from '../src/cli/logs.js';
import { routeCommand } from '../src/cli/route.js';

const args = process.argv.slice(2);
const command = (args[0] || 'help').toLowerCase();
const rest = args.slice(1);

async function main() {
  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      return 0;
    case 'start':
      return startCommand(rest);
    case 'stop':
      return stopCommand();
    case 'restart': {
      await stopCommand();
      // brief pause so ports/PIDs release on Windows
      await new Promise((r) => setTimeout(r, 500));
      return startCommand(rest);
    }
    case 'status':
      return statusCommand();
    case 'tunnel':
      return tunnelCommand();
    case 'config':
      return configCommand(rest);
    case 'logs':
      return logsCommand(rest);
    case 'route':
      return routeCommand(rest);
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      return 1;
  }
}

main()
  .then((code) => {
    const keepAlive = (command === 'start' || command === 'restart') && code === 0;
    if (!keepAlive) {
      process.exit(code ?? 0);
    }
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
