#!/usr/bin/env bash
#
# Met à jour Harmony2FreeboxRCMapper sur le serveur Jeedom via SSH, redémarre le service
# systemd puis vérifie que l'interface web répond.
#
# Configuration par variables d'environnement (valeurs par défaut entre parenthèses) :
#   JEEDOM_HOST (192.168.1.248), JEEDOM_USER (alban),
#   JEEDOM_APP_DIR (/home/alban/Harmony2FreeboxRCMapper),
#   JEEDOM_SERVICE (Harmony2FreeboxRCMapper), JEEDOM_APP_PORT (8042)

set -euo pipefail

readonly EXIT_UP_TO_DATE=10
readonly HEALTH_CHECK_ATTEMPTS=15
readonly HEALTH_CHECK_DELAY_SECONDS=2

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
remote_script="$script_dir/jeedom-remote-update.sh"

host=${JEEDOM_HOST:-192.168.1.248}
user=${JEEDOM_USER:-alban}
app_dir=${JEEDOM_APP_DIR:-/home/alban/Harmony2FreeboxRCMapper}
service=${JEEDOM_SERVICE:-Harmony2FreeboxRCMapper}
port=${JEEDOM_APP_PORT:-8042}

branch=""
dry_run=false
force_restart=false

usage() {
  cat <<'EOF'
Usage : scripts/deploy-jeedom.sh [--branch <branche>] [--dry-run] [--force-restart]

  -b, --branch         Branche à déployer (défaut : celle déjà extraite sur le serveur)
  -n, --dry-run        Affiche les commits qui seraient appliqués, sans rien modifier
  -f, --force-restart  Redémarre le service même s'il n'y a rien à mettre à jour
  -h, --help           Affiche cette aide
EOF
}

die() {
  echo "ERREUR : $*" >&2
  exit 1
}

info() {
  echo "==> $*"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--branch) [[ -n "${2:-}" ]] || die "l'option $1 attend une valeur"; branch="$2"; shift 2 ;;
    -n|--dry-run) dry_run=true; shift ;;
    -f|--force-restart) force_restart=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "option inconnue : $1" ;;
  esac
done

[[ "$port" =~ ^[0-9]+$ ]] || die "JEEDOM_APP_PORT invalide : $port"
[[ -r "$remote_script" ]] || die "script introuvable : $remote_script"

target="$user@$host"
quoted_service=$(printf '%q' "$service")

remote_args=(--dir "$app_dir" --service "$service")
[[ -n "$branch" ]] && remote_args+=(--branch "$branch")
$dry_run && remote_args+=(--dry-run)

info "Mise à jour du dépôt sur $target:$app_dir"
set +e
ssh -o ConnectTimeout=10 "$target" "bash -s -- $(printf '%q ' "${remote_args[@]}")" < "$remote_script"
update_status=$?
set -e

case "$update_status" in
  0) ;;
  "$EXIT_UP_TO_DATE")
    if ! $force_restart; then
      info "Rien à déployer, le service n'est pas redémarré (utilisez --force-restart pour le forcer)"
      exit 0
    fi
    ;;
  *) die "la mise à jour du dépôt a échoué (code $update_status) : service non redémarré" ;;
esac

$dry_run && exit 0

show_service_logs() {
  ssh -t -o ConnectTimeout=10 "$target" "sudo journalctl -u $quoted_service -n 30 --no-pager" \
    || echo "Impossible de lire les journaux du service" >&2
}

info "Redémarrage du service $service (sudo peut demander votre mot de passe)"
if ! ssh -t -o ConnectTimeout=10 "$target" "sudo systemctl restart $quoted_service"; then
  show_service_logs
  die "le redémarrage du service a échoué"
fi

app_url="http://$host:$port/"
info "Vérification de $app_url"
for ((attempt = 1; attempt <= HEALTH_CHECK_ATTEMPTS; attempt++)); do
  http_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$app_url" || true)
  if [[ "$http_code" =~ ^[23] ]]; then
    info "Application opérationnelle (HTTP $http_code)"
    exit 0
  fi
  sleep "$HEALTH_CHECK_DELAY_SECONDS"
done

show_service_logs
die "l'application ne répond pas sur $app_url après redémarrage"
