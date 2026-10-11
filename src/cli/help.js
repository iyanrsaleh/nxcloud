export function printHelp() {
  console.log(`
nxcloud — local Node.js server + Cloudflare Tunnel

Usage:
  nxcloud <command> [options]

Commands:
  start       Start local server and Cloudflare Tunnel
  stop        Stop running nxcloud processes
  restart     Restart nxcloud
  status      Show server and tunnel status
  tunnel      Show tunnel information
  route       Manage hostname -> origin routes
  config      Show or change configuration
  logs        Show recent logs
  help        Show this help

Route (connect a new hostname to an external app, same as Domain/Routes in the Desktop app):
  nxcloud route list
  nxcloud route add <hostname|subdomain> <port> [--root <domain>] [--name <nama>]
  nxcloud route ping <id>
  nxcloud route set-port <id> <port>
  nxcloud route remove <id>

Config:
  nxcloud config show
  nxcloud config get <key>
  nxcloud config set <key> <value>
  nxcloud config keys
  nxcloud config path

Start options:
  --no-tunnel   Start local server only (skip cloudflared)

Examples:
  nxcloud start
  nxcloud start --no-tunnel
  nxcloud config set server.port 8788
  nxcloud config set cloudflare.rootDomains example.com
  nxcloud route add blog 3000
  nxcloud route add blog.example.com 3000
  nxcloud status
`.trim());
}
