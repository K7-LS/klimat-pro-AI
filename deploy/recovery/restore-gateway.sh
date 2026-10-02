#!/usr/bin/env bash
# Explicitly authorized recovery after deletion of the original VDSina gateway.
set -euo pipefail
umask 077
ROOT=/mnt/f/Сайт/redesign-v2-fresh
WEB=/srv/daniil-deploy
SUPA=/srv/supabase-src/docker
IP=83.217.214.234
HOST=83-217-214-234.sslip.io
VPS=root@$IP
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP="$WEB/backups/vps-recovery-$STAMP"
mkdir -p "$BACKUP"
cp /etc/frp/frpc.toml "$BACKUP/frpc.toml"
cp "$SUPA/.env" "$BACKUP/supabase.env"
cp "$WEB/docker-compose.web.yml" "$BACKUP/docker-compose.web.yml"
cp "$ROOT/.env.production" "$BACKUP/frontend.env.production"
cp -a "$WEB/web" "$BACKUP/web"
python3 - "$BACKUP" "$ROOT" <<'PY'
from pathlib import Path
import secrets, sys
b, root = map(Path, sys.argv[1:])
(b / 'frp-token').write_text(secrets.token_hex(32))
(b / 'Caddyfile').write_text((root / 'deploy/mcp/Caddyfile').read_text().replace('193-124-130-236.sslip.io', '83-217-214-234.sslip.io'))
PY
ssh -o BatchMode=yes -o ConnectTimeout=10 "$VPS" 'install -d -m 700 /root/klimat-recovery'
scp "$BACKUP/frp-token" "$BACKUP/Caddyfile" "$ROOT/deploy/recovery/bootstrap-vps.sh" "$ROOT/deploy/recovery/frps.service" "$VPS:/root/klimat-recovery/"
ssh "$VPS" "bash /root/klimat-recovery/bootstrap-vps.sh '$HOST'"
touch "$BACKUP/vps-ready.flag"
# Check a second SSH connection before repointing the local service.
ssh -o BatchMode=yes "$VPS" 'systemctl is-active frps caddy'

python3 - "$BACKUP" <<'PY'
from pathlib import Path
import re, sys
b = Path(sys.argv[1])
frpc = Path('/etc/frp/frpc.toml')
s = frpc.read_text()
s, n = re.subn(r'^serverAddr\s*=.*$', 'serverAddr = "83.217.214.234"', s, flags=re.M)
if n != 1: raise SystemExit('frpc serverAddr missing')
s, n = re.subn(r'^auth\.token\s*=.*$', 'auth.token = "' + (b / 'frp-token').read_text() + '"', s, flags=re.M)
if n != 1: raise SystemExit('frpc token missing')
frpc.write_text(s)
env = Path('/srv/supabase-src/docker/.env')
s = env.read_text()
for key in ('API_EXTERNAL_URL', 'SITE_URL'):
    s, n = re.subn(r'^' + key + r'=.*$', key + '=https://83-217-214-234.sslip.io', s, flags=re.M)
    if n != 1: raise SystemExit(f'{key} missing')
env.write_text(s)
compose = Path('/srv/daniil-deploy/docker-compose.web.yml')
compose.write_text(compose.read_text().replace('193-124-130-236.sslip.io', '83-217-214-234.sslip.io'))
env = Path('/mnt/f/Сайт/redesign-v2-fresh/.env.production')
env.write_text(env.read_text().replace('193-124-130-236.sslip.io', '83-217-214-234.sslip.io'))
PY
/usr/local/bin/frpc verify -c /etc/frp/frpc.toml
systemctl restart frpc
cd "$SUPA"
docker compose config --quiet
docker compose up -d --no-deps auth
cd "$WEB"
docker compose -f docker-compose.web.yml --env-file "$SUPA/.env" config --quiet
docker compose -f docker-compose.web.yml --env-file "$SUPA/.env" up -d --no-deps mcp
for _ in $(seq 1 30); do
  if docker inspect -f '{{.State.Health.Status}}' daniil-mcp | grep -qx healthy; then break; fi
  sleep 2
done
docker inspect -f '{{.State.Health.Status}}' daniil-mcp | grep -qx healthy
# nginx resolves the recreated MCP container during startup.
docker restart daniil-web
touch "$BACKUP/local-repointed.flag"
echo "GATEWAY_RESTORED backup=$BACKUP origin=https://$HOST"
