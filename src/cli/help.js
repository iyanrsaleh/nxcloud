export function printHelp() {
  console.log(`
NxCloudflare — local Node.js server + Cloudflare Tunnel

Usage:
  nxcloudflare <command> [options]

Commands:
  start       Start local server and Cloudflare Tunnel
  stop        Stop running NxCloudflare processes
  restart     Restart NxCloudflare
  status      Show server and tunnel status
  tunnel      Show tunnel information
  route       Manage hostname -> origin routes
  config      Show or change configuration
  logs        Show recent logs
  help        Show this help

Route (connect a new hostname to an external app, same as Domain/Routes in the Desktop app):
  nxcloudflare route list
  nxcloudflare route add <hostname|subdomain> <port> [--root <domain>] [--name <nama>]
  nxcloudflare route ping <id>
  nxcloudflare route set-port <id> <port>
  nxcloudflare route remove <id>

Config:
  nxcloudflare config show
  nxcloudflare config get <key>
  nxcloudflare config set <key> <value>
  nxcloudflare config keys
  nxcloudflare config path

Start options:
  --no-tunnel   Start local server only (skip cloudflared)

Examples:
  nxcloudflare start
  nxcloudflare start --no-tunnel
  nxcloudflare config set server.port 8788
  nxcloudflare config set cloudflare.rootDomains example.com
  nxcloudflare route add blog 3000
  nxcloudflare route add blog.example.com 3000
  nxcloudflare status
`.trim());
}
