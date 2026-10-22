#!/usr/bin/env bash
# Installs (or updates) Seicore on a fresh Ubuntu server, served over HTTPS by Caddy.
#
#   sudo bash setup.sh your-name.duckdns.org you@example.com
#
# Safe to re-run: it pulls the latest code, rebuilds and restarts.
set -euo pipefail

DOMAIN=${1:?Usage: sudo bash setup.sh <domain> [email]}
EMAIL=${2:-}
REPO=${REPO:-https://github.com/semiscrazy/Seicore1.git}
BRANCH=${BRANCH:-claude/productivity-app-routine-mgmt-oacg1s}
APP_DIR=/opt/seicore
DATA_DIR=/var/lib/seicore

[[ $EUID -eq 0 ]] || { echo "Run with sudo." >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive
step() { echo -e "\n==> $*"; }

step "Installing system packages"
apt-get update -q
apt-get install -y -q git curl ca-certificates gnupg sqlite3 debian-keyring debian-archive-keyring apt-transport-https iptables-persistent

# Small instances (1 GB RAM) need swap to build the web app.
if [[ $(free -m | awk '/^Mem:/ {print $2}') -lt 2000 && ! -f /swapfile ]]; then
  step "Adding 2 GB swap"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' 2>/dev/null; then
  step "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

if ! command -v caddy >/dev/null; then
  step "Installing Caddy (automatic HTTPS)"
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

step "Fetching Seicore ($BRANCH)"
id seicore >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin seicore
mkdir -p "$DATA_DIR/backups"
chown -R seicore:seicore "$DATA_DIR"
if [[ -d $APP_DIR/.git ]]; then
  git -C "$APP_DIR" fetch -q origin "$BRANCH"
  git -C "$APP_DIR" checkout -q -B "$BRANCH" "origin/$BRANCH"
else
  git clone -q --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

step "Building"
cd "$APP_DIR"
npm ci --no-audit --no-fund
npm run build

step "Configuring the service"
cat > /etc/systemd/system/seicore.service <<UNIT
[Unit]
Description=Seicore
After=network.target

[Service]
User=seicore
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production PORT=3001 DATA_DIR=$DATA_DIR COOKIE_SECURE=true VAPID_SUBJECT=mailto:${EMAIL:-admin@$DOMAIN}
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning $APP_DIR/server/dist/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable -q seicore
systemctl restart seicore

{
  [[ -n $EMAIL ]] && printf '{\n\temail %s\n}\n\n' "$EMAIL"
  cat <<CADDY
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:3001
}
CADDY
} > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

step "Opening ports 80 and 443"
for port in 80 443; do
  iptables -C INPUT -p tcp --dport $port -m state --state NEW -j ACCEPT 2>/dev/null ||
    iptables -I INPUT -p tcp --dport $port -m state --state NEW -j ACCEPT
done
netfilter-persistent save >/dev/null

step "Scheduling a daily database backup (keeps 14 days)"
cat > /usr/local/bin/seicore-backup <<BACKUP
#!/bin/sh
[ -f $DATA_DIR/seicore.db ] || exit 0
sqlite3 $DATA_DIR/seicore.db ".backup '$DATA_DIR/backups/seicore-\$(date +%F).db'"
find $DATA_DIR/backups -name 'seicore-*.db' -mtime +14 -delete
BACKUP
chmod +x /usr/local/bin/seicore-backup
echo "30 3 * * * seicore /usr/local/bin/seicore-backup" > /etc/cron.d/seicore-backup

sleep 2
if curl -fs http://127.0.0.1:3001/api/health >/dev/null; then
  echo -e "\nDone! Open https://$DOMAIN and create your account."
  echo "(The HTTPS certificate can take a minute on the first visit.)"
else
  echo -e "\nSeicore didn't start. See: journalctl -u seicore -n 50" >&2
  exit 1
fi
