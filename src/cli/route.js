import {
  listRoutes,
  getRoute,
  createRoute,
  updateRoute,
  deleteRoute,
  pingRouteOrigin
} from '../api/routes.js';
import { getManagedRootDomains } from '../cloudflare/dns.js';

function printSyncNote(sync) {
  if (!sync) return;
  if (!sync.written) {
    console.log(`(ingress tunnel belum ditulis: ${sync.reason || 'lihat log'})`);
    return;
  }
  console.log('Ingress tunnel diperbarui — restart tunnel agar berlaku.');
}

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      flags[key] = value;
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function printList() {
  const data = listRoutes();
  if (!data.routes.length) {
    console.log('Belum ada route. Tambah dengan: nxcloud route add <hostname> <port>');
    return 0;
  }
  for (const r of data.routes) {
    const status = r.enabled !== false ? 'aktif' : 'nonaktif';
    console.log(`${r.id}\t${r.hostname}\t-> ${r.origin}\t[${status}]`);
  }
  return 0;
}

async function addRoute(positional, flags) {
  const [hostname, port] = positional;
  if (!hostname || !port) {
    console.error('Usage: nxcloud route add <hostname> <port> [--root <domain>] [--name <nama>]');
    return 1;
  }

  let fullHostname = hostname;
  if (!hostname.includes('.')) {
    const roots = getManagedRootDomains();
    const root = flags.root || (roots.length === 1 ? roots[0] : null);
    if (!root) {
      console.error(
        roots.length
          ? `Hostname "${hostname}" tidak lengkap dan ada >1 root domain terkelola — pakai --root <domain>.\nRoot domain terkelola: ${roots.join(', ')}`
          : 'Belum ada root domain terkelola. Set dulu: nxcloud config set cloudflare.rootDomains <domain>'
      );
      return 1;
    }
    fullHostname = `${hostname}.${root}`;
  }

  const name = flags.name || hostname;
  const origin = `http://127.0.0.1:${port}`;

  try {
    const result = await createRoute({ name, hostname: fullHostname, origin });
    console.log(`Route "${result.route.id}" dibuat: ${fullHostname} -> ${origin}`);
    if (result.dns?.alreadyExisted) {
      console.log('DNS sudah ada sebelumnya (tidak dibuat ulang).');
    } else if (result.dns?.created) {
      console.log('DNS CNAME baru dibuat di Cloudflare.');
    } else if (result.dns?.error) {
      console.error(`DNS gagal dibuat: ${result.dns.error}`);
    }
    printSyncNote(result.sync);
    return 0;
  } catch (err) {
    console.error(`Gagal membuat route: ${err.message}`);
    return 1;
  }
}

async function pingRoute(positional) {
  const [id] = positional;
  if (!id) {
    console.error('Usage: nxcloud route ping <id>');
    return 1;
  }
  try {
    const r = await pingRouteOrigin(id);
    if (r.reachable) {
      console.log(`OK (${r.status}, ${r.durationMs}ms)`);
      return 0;
    }
    console.error(`Gagal: ${r.error}`);
    return 1;
  } catch (err) {
    console.error(err.message);
    return 1;
  }
}

function setPort(positional) {
  const [id, port] = positional;
  if (!id || !port) {
    console.error('Usage: nxcloud route set-port <id> <port>');
    return 1;
  }
  try {
    const prev = getRoute(id);
    const newOrigin = prev.origin.replace(/:(\d+)(\/|$)/, `:${port}$2`);
    const result = updateRoute(id, { origin: newOrigin });
    console.log(`Route "${id}" port diubah ke ${port} (${result.route.origin}).`);
    printSyncNote(result.sync);
    return 0;
  } catch (err) {
    console.error(`Gagal mengubah port: ${err.message}`);
    return 1;
  }
}

function removeRoute(positional) {
  const [id] = positional;
  if (!id) {
    console.error('Usage: nxcloud route remove <id>');
    return 1;
  }
  try {
    const result = deleteRoute(id);
    console.log(`Route "${id}" dihapus.`);
    console.log('DNS record di Cloudflare TIDAK ikut terhapus otomatis — hapus manual di dashboard bila perlu.');
    printSyncNote(result.sync);
    return 0;
  } catch (err) {
    console.error(`Gagal menghapus route: ${err.message}`);
    return 1;
  }
}

export async function routeCommand(args = []) {
  const sub = (args[0] || 'list').toLowerCase();
  const { flags, positional } = parseFlags(args.slice(1));

  if (sub === 'list' || sub === 'ls') return printList();
  if (sub === 'add') return addRoute(positional, flags);
  if (sub === 'ping') return pingRoute(positional);
  if (sub === 'set-port') return setPort(positional);
  if (sub === 'remove' || sub === 'rm' || sub === 'delete') return removeRoute(positional);

  console.error(`Unknown route subcommand: ${sub}`);
  console.error('Usage: nxcloud route [list|add|ping|set-port|remove]');
  return 1;
}
