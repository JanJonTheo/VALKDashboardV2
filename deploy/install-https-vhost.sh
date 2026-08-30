#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with administrative rights (sudo)." >&2
  exit 1
fi
if [[ -z "${CERTBOT_EMAIL:-}" ]]; then
  echo "Set CERTBOT_EMAIL before running this script." >&2
  exit 1
fi

APP_DIR="/home/valk/dashboard-v2/current"
AVAILABLE="/etc/nginx/sites-available/valk-dashboard"
ENABLED="/etc/nginx/sites-enabled/valk-dashboard"
UPS_CONFIG="/etc/nginx/sites-available/upsapp"
UPS_EXTRA="/etc/nginx/ups_lizenz4_server"
WEBROOT="/var/www/valk-elite.de"
STATE_DIR="$(mktemp -d /tmp/valk-dashboard-nginx.XXXXXX)"
RUNTIME_ENV="/home/valk/dashboard-v2/shared/runtime.env"
DASHBOARD_SOCKET="/run/ups_lizenz4_server/app.sock"
RUNTIME_SWITCHED=0
PROBE_FILE=""

if [[ -e "$AVAILABLE" || -e "$ENABLED" ]]; then
  echo "The VALK vhost already exists; aborting without changing it." >&2
  exit 1
fi

AUTHORITATIVE_NAMESERVERS=(ns.second-ns.com ns1.your-server.de ns3.second-ns.de)
mapfile -t LOCAL_ADDRESSES < <(ip -o addr show scope global | awk '{print $4}' | cut -d/ -f1)
mapfile -t DNS_IPV4 < <(
  for nameserver in "${AUTHORITATIVE_NAMESERVERS[@]}"; do
    dig +short A valk-elite.de "@$nameserver"
  done | sort -u
)
mapfile -t DNS_IPV6 < <(
  for nameserver in "${AUTHORITATIVE_NAMESERVERS[@]}"; do
    dig +short AAAA valk-elite.de "@$nameserver"
  done | sort -u
)
DNS_ADDRESSES=("${DNS_IPV4[@]}" "${DNS_IPV6[@]}")
for address in "${DNS_ADDRESSES[@]}"; do
  if [[ -n "$address" ]] && ! printf '%s\n' "${LOCAL_ADDRESSES[@]}" | grep -Fx "$address" >/dev/null; then
    echo "DNS address $address is not assigned to this server; refusing the certificate request." >&2
    echo "Update or remove the mismatching A/AAAA record and wait for DNS propagation." >&2
    exit 1
  fi
done

cleanup() { rm -rf -- "$STATE_DIR"; }
trap cleanup EXIT

sha256sum "$UPS_CONFIG" >"$STATE_DIR/ups.before"
find "$UPS_EXTRA" -maxdepth 1 -type f -print0 | sort -z | xargs -0 -r sha256sum >"$STATE_DIR/ups-extra.before"
readlink -f /etc/nginx/sites-enabled/upsapp >"$STATE_DIR/ups-link.before"
echo | openssl s_client -connect ups.fleeton.info:443 -servername ups.fleeton.info 2>/dev/null | openssl x509 -noout -serial -fingerprint -sha256 >"$STATE_DIR/ups-cert.before"
curl --fail --silent --show-error --output /dev/null --write-out '%{http_code}\n' https://ups.fleeton.info/ >"$STATE_DIR/ups-http.before"
test -S "$DASHBOARD_SOCKET"
cp --preserve=mode,ownership "$RUNTIME_ENV" "$STATE_DIR/runtime.env.before"

rollback() {
  if [[ -n "$PROBE_FILE" ]]; then rm -f -- "$PROBE_FILE"; fi
  rm -f -- "$ENABLED" "$AVAILABLE"
  cp --preserve=mode,ownership "$STATE_DIR/runtime.env.before" "$RUNTIME_ENV"
  nginx -t && systemctl reload nginx
  if [[ "$RUNTIME_SWITCHED" -eq 1 ]]; then
    current_pid="$(cat "$APP_DIR/run/dashboard.pid" 2>/dev/null || true)"
    if [[ -n "$current_pid" ]]; then kill -TERM "$current_pid" 2>/dev/null || true; fi
    runuser -u valk -- "$APP_DIR/deploy/ensure-native.sh" || true
  fi
}
trap 'rollback' ERR

install -d -m 0755 "$WEBROOT"
install -m 0644 "$APP_DIR/deploy/nginx/valk-dashboard-bootstrap.conf" "$AVAILABLE"
ln -sfn "$AVAILABLE" "$ENABLED"
nginx -t
systemctl reload nginx

PROBE_NAME="preflight-$(date +%s)-$$"
PROBE_VALUE="valk-dashboard-acme-preflight"
install -d -m 0755 "$WEBROOT/.well-known/acme-challenge"
PROBE_FILE="$WEBROOT/.well-known/acme-challenge/$PROBE_NAME"
printf '%s' "$PROBE_VALUE" >"$PROBE_FILE"
PROBE_URL="http://valk-elite.de/.well-known/acme-challenge/$PROBE_NAME"

probe_acme_address() {
  local family="$1"
  local address="$2"
  local resolve="$address"
  local response=""
  if [[ "$family" = "-6" ]]; then resolve="[$address]"; fi
  for attempt in {1..20}; do
    response="$(curl --noproxy '*' --silent --show-error "$family" --resolve "valk-elite.de:80:$resolve" "$PROBE_URL" 2>/dev/null || true)"
    if [[ "$response" = "$PROBE_VALUE" ]]; then return 0; fi
    sleep 0.5
  done
  echo "$family ACME preflight failed for $address after waiting for the Nginx reload; rolling back." >&2
  return 1
}

for address in "${DNS_IPV4[@]}"; do
  probe_acme_address -4 "$address"
done
for address in "${DNS_IPV6[@]}"; do
  probe_acme_address -6 "$address"
done
rm -f -- "$PROBE_FILE"
PROBE_FILE=""

certbot certonly --webroot -w "$WEBROOT" -d valk-elite.de --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email --non-interactive

install -m 0644 "$APP_DIR/deploy/nginx/valk-dashboard.conf" "$AVAILABLE"
nginx -t
systemctl reload nginx

sha256sum -c "$STATE_DIR/ups.before"
find "$UPS_EXTRA" -maxdepth 1 -type f -print0 | sort -z | xargs -0 -r sha256sum >"$STATE_DIR/ups-extra.after"
cmp "$STATE_DIR/ups-extra.before" "$STATE_DIR/ups-extra.after"
test "$(readlink -f /etc/nginx/sites-enabled/upsapp)" = "$(cat "$STATE_DIR/ups-link.before")"
echo | openssl s_client -connect ups.fleeton.info:443 -servername ups.fleeton.info 2>/dev/null | openssl x509 -noout -serial -fingerprint -sha256 >"$STATE_DIR/ups-cert.after"
cmp "$STATE_DIR/ups-cert.before" "$STATE_DIR/ups-cert.after"
curl --fail --silent --show-error --output /dev/null --write-out '%{http_code}\n' https://ups.fleeton.info/ >"$STATE_DIR/ups-http.after"
cmp "$STATE_DIR/ups-http.before" "$STATE_DIR/ups-http.after"
test -S "$DASHBOARD_SOCKET"
curl --fail --silent --show-error --output /dev/null https://valk-elite.de/api/health
test "$(curl --silent --output /dev/null --write-out '%{http_code}' http://valk-elite.de/)" = "301"

runuser -u valk -- python3 "$APP_DIR/deploy/enable-https-runtime.py" "$RUNTIME_ENV"
RUNTIME_SWITCHED=1
dashboard_pid="$(cat "$APP_DIR/run/dashboard.pid")"
kill -TERM "$dashboard_pid"
for attempt in {1..20}; do
  if ! kill -0 "$dashboard_pid" 2>/dev/null; then break; fi
  sleep 1
done
runuser -u valk -- "$APP_DIR/deploy/ensure-native.sh"
for attempt in {1..30}; do
  if curl --fail --silent --max-time 3 http://127.0.0.1:8889/api/health >/dev/null; then break; fi
  sleep 1
done
curl --fail --silent --show-error --output /dev/null https://valk-elite.de/api/health
ss -ltnH 'sport = :8889' | grep -F '127.0.0.1:8889' >/dev/null

trap - ERR
echo "VALK HTTPS vhost installed; UPS configuration, certificate and socket route are unchanged."
