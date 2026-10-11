import { loadConfig, getConfigPath, setConfigValue, getByPath, CONFIG_KEYS } from '../config.js';

export async function configCommand(args = []) {
  const sub = (args[0] || 'show').toLowerCase();

  if (sub === 'show' || sub === 'list') {
    const config = loadConfig();
    console.log(`Config file: ${getConfigPath()}\n`);
    console.log(JSON.stringify(config, null, 2));
    return 0;
  }

  if (sub === 'path') {
    console.log(getConfigPath());
    return 0;
  }

  if (sub === 'get') {
    const key = args[1];
    if (!key) {
      console.error('Usage: nxcloud config get <key>');
      return 1;
    }
    const config = loadConfig();
    const value = getByPath(config, key);
    if (value === undefined) {
      console.error(`Key not found: ${key}`);
      return 1;
    }
    console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
    return 0;
  }

  if (sub === 'set') {
    const key = args[1];
    const value = args[2];
    if (!key || value === undefined) {
      console.error('Usage: nxcloud config set <key> <value>');
      console.error(`Keys:\n  ${CONFIG_KEYS.join('\n  ')}`);
      return 1;
    }
    const config = setConfigValue(key, value);
    console.log(`Set ${key} = ${JSON.stringify(getByPath(config, key))}`);
    console.log(`Saved: ${getConfigPath()}`);
    return 0;
  }

  if (sub === 'keys') {
    console.log(CONFIG_KEYS.join('\n'));
    return 0;
  }

  console.error(`Unknown config subcommand: ${sub}`);
  console.error('Usage: nxcloud config [show|get|set|path|keys]');
  return 1;
}
