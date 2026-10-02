#!/usr/bin/env bash
# Restore only the external gateway on a freshly created VPS.
set -euo pipefail
umask 077
HOST=${1:?public hostname required}
case "$HOST" in 83-217-214-234.sslip.io) ;; *) echo 'Unexpected recovery hostname' >&2; exit 2 ;; esac
test -s /root/klimat-recovery/frp-token
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y --no-install-recommends curl ca-certificates gnupg ufw python3
curl --fail --silent --show-error --location https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o /root/klimat-recovery/caddy.gpg
gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg /root/klimat-recovery/caddy.gpg
curl --fail --silent --show-error --location https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
chmod 644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
apt-get update -q
apt-get install -y --no-install-recommends caddy

cd /root/klimat-recovery
curl --fail --silent --show-error --location --retry 3 https://api.github.com/repos/fatedier/frp/releases/tags/v0.69.0 -o release.json
python3 - <<'PY'
import json, pathlib
release = json.loads(pathlib.Path('release.json').read_text())
asset = next(a for a in release['assets'] if a['name'] == 'frp_0.69.0_linux_amd64.tar.gz')
digest = asset.get('digest', '')
if not digest.startswith('sha256:'):
    raise SystemExit('GitHub release asset SHA256 missing; do not install unverified archive')
pathlib.Path('frp.url').write_text(asset['browser_download_url'])
pathlib.Path('frp.sha256').write_text(digest.split(':', 1)[1] + '  frp.tar.gz\n')
PY
curl --fail --silent --show-error --location --retry 3 "$(<frp.url)" -o frp.tar.gz
sha256sum --check frp.sha256
tar -xzf frp.tar.gz
install -m 755 frp_0.69.0_linux_amd64/frps /usr/local/bin/frps
id frp >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin frp
install -d -m 750 -o frp -g frp /etc/frp
python3 - <<'PY'
from pathlib import Path
token = Path('/root/klimat-recovery/frp-token').read_text().strip()
if len(token) != 64 or any(c not in '0123456789abcdef' for c in token):
    raise SystemExit('Invalid token')
Path('/etc/frp/frps.toml').write_text(f'''bindAddr = "0.0.0.0"
bindPort = 7000
proxyBindAddr = "127.0.0.1"
auth.method = "token"
auth.token = "{token}"
transport.tls.force = true
allowPorts = [{{ start = 8000, end = 8000 }}, {{ start = 8080, end = 8080 }}]
''')
PY
chown frp:frp /etc/frp/frps.toml
chmod 600 /etc/frp/frps.toml
install -m 644 /root/klimat-recovery/frps.service /etc/systemd/system/frps.service
install -m 644 /root/klimat-recovery/Caddyfile /etc/caddy/Caddyfile
/usr/local/bin/frps verify -c /etc/frp/frps.toml
caddy validate --config /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now frps
systemctl reload-or-restart caddy
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 7000/tcp
ufw --force enable
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/00-klimat-hardening.conf
sshd -t
systemctl reload ssh
systemctl is-active frps caddy
echo VPS_GATEWAY_READY
