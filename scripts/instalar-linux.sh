#!/usr/bin/env bash
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v docker &>/dev/null || {
    apt-get update -y
    apt-get install -y ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    . /etc/os-release
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] $UBUNTU_CODENAME stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-compose-plugin
    systemctl enable --now docker
}

cp "$RAIZ/.env.example" "$RAIZ/.env" 2>/dev/null || true

cat > /etc/systemd/system/autoservicio.service <<EOF
[Unit]
Description=Autoservicio stack
Requires=docker.service
After=docker.service network-online.target
[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$RAIZ
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
[Install]
WantedBy=multi-user.target
EOF

cat > /usr/local/sbin/autoservicio-backup.sh <<EOF
#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$RAIZ/backups"
CONTAINER=autoservicio_db
DB=\$(grep '^POSTGRES_DB=' "$RAIZ/.env" | cut -d= -f2)
USER=\$(grep '^POSTGRES_USER=' "$RAIZ/.env" | cut -d= -f2)
PASS=\$(grep '^POSTGRES_PASSWORD=' "$RAIZ/.env" | cut -d= -f2)
DEST="$RAIZ/backups/autoservicio_\$(date +%Y%m%d_%H%M).dump"
docker exec -e PGPASSWORD="\$PASS" \$CONTAINER pg_dump -U \$USER -d \$DB -Fc -f /tmp/autoservicio.dump
docker cp \$CONTAINER:/tmp/autoservicio.dump \$DEST
docker exec \$CONTAINER rm -f /tmp/autoservicio.dump
ls -1rt "$RAIZ/backups/"*.dump | head -n -14 | xargs -r rm -f
EOF
chmod +x /usr/local/sbin/autoservicio-backup.sh

cat > /usr/local/bin/autoservicio-kiosko <<EOF
#!/usr/bin/env bash
exec chromium-browser --kiosk --disable-restore-session-state http://localhost:5173
EOF
chmod +x /usr/local/bin/autoservicio-kiosko
command -v chromium-browser &>/dev/null || apt-get install -y chromium-browser || true

(crontab -l 2>/dev/null | grep -v autoservicio-backup; echo "0 4 * * * /usr/local/sbin/autoservicio-backup.sh >/dev/null 2>&1") | crontab -

systemctl daemon-reload
systemctl enable autoservicio.service
systemctl start autoservicio.service

echo "Instalado. Servicio en http://localhost:5173 (kiosko: autoservicio-kiosko)",
echo "Backup diario a las 04:00 en $RAIZ/backups"