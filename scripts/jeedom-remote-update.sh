#!/usr/bin/env bash
#
# Met à jour le dépôt git de l'application sur le serveur Jeedom.
# Exécuté sur le serveur (via `ssh hôte bash -s -- <options> < ce-script`) par deploy-jeedom.sh.
# Ne redémarre pas le service : c'est le rôle de deploy-jeedom.sh.
#
# Codes de sortie : 0 = mis à jour (ou simulation OK), 10 = déjà à jour, 1 = erreur.

set -euo pipefail

readonly EXIT_UP_TO_DATE=10
readonly DEPENDENCY_FILES=(package.json package-lock.json yarn.lock)

app_dir=""
branch=""
service=""
entry=""
dry_run=false

usage() {
  cat <<'EOF'
Usage : jeedom-remote-update.sh --dir <dossier> [--branch <branche>] [--service <nom>] [--entry <fichier>] [--dry-run]

  --dir      Dossier du dépôt git de l'application (obligatoire)
  --branch   Branche à déployer (défaut : branche actuellement extraite)
  --service  Service systemd, pour vérifier que son fichier ExecStart existe sur la révision cible
  --entry    Fichier d'entrée à vérifier (prioritaire sur --service)
  --dry-run  Affiche les commits qui seraient appliqués, sans rien modifier
EOF
}

die() {
  echo "ERREUR : $*" >&2
  exit 1
}

info() {
  echo "==> $*"
}

require_value() {
  [[ -n "${2:-}" ]] || die "l'option $1 attend une valeur"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) require_value "$1" "${2:-}"; app_dir="$2"; shift 2 ;;
    --branch) require_value "$1" "${2:-}"; branch="$2"; shift 2 ;;
    --service) require_value "$1" "${2:-}"; service="$2"; shift 2 ;;
    --entry) require_value "$1" "${2:-}"; entry="$2"; shift 2 ;;
    --dry-run) dry_run=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "option inconnue : $1" ;;
  esac
done

[[ -n "$app_dir" ]] || { usage >&2; die "--dir est obligatoire"; }
cd "$app_dir" 2>/dev/null || die "dossier introuvable : $app_dir"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "$app_dir n'est pas un dépôt git"

if [[ -n "$branch" ]]; then
  git check-ref-format --branch "$branch" >/dev/null 2>&1 || die "nom de branche invalide : $branch"
fi

# Les fichiers non suivis (rules.json, node_modules…) sont ignorés ; seules les modifications
# de fichiers suivis bloquent, pour ne jamais écraser un correctif fait à la main sur le serveur.
if ! git diff --quiet || ! git diff --cached --quiet; then
  git status --short --untracked-files=no >&2
  die "modifications locales sur des fichiers suivis : commitez-les ou annulez-les avant la mise à jour"
fi

current_branch=$(git symbolic-ref --short -q HEAD) || die "HEAD détachée : extrayez une branche avant la mise à jour"
target_branch=${branch:-$current_branch}
target_ref="origin/$target_branch"

info "Récupération des nouveautés (git fetch origin)"
git fetch --prune --quiet origin || die "git fetch a échoué (réseau ? accès au dépôt ?)"

git rev-parse --verify --quiet "refs/remotes/$target_ref" >/dev/null || die "branche distante introuvable : $target_ref"

if [[ -z "$entry" && -n "$service" ]]; then
  # Extrait le premier fichier .js de la ligne ExecStart active (ex. ./src/server_multi_unified.js).
  entry=$(systemctl cat "$service" 2>/dev/null \
    | sed -n 's/^ExecStart=.*[[:space:]]\(\.\/\)\{0,1\}\([^[:space:]]*\.js\).*/\2/p' \
    | head -n 1) || true
  [[ -n "$entry" ]] || echo "Attention : fichier d'entrée du service $service non déterminé, vérification ignorée" >&2
fi
entry=${entry#./}

# Liste les branches distantes (sans le préfixe origin/) dont la révision contient le fichier $1.
remote_branches_with_file() {
  local ref
  while IFS= read -r ref; do
    [[ "$ref" == "origin/HEAD" ]] && continue
    git cat-file -e "$ref:$1" 2>/dev/null && echo "${ref#origin/}"
  done < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin)
  return 0 # une absence de résultat n'est pas une erreur (set -e / pipefail)
}

if [[ -n "$entry" ]] && ! git cat-file -e "$target_ref:$entry" 2>/dev/null; then
  candidates=$(remote_branches_with_file "$entry" | paste -sd ' ' -)
  if [[ -n "$candidates" ]]; then
    hint="branches distantes qui le contiennent : $candidates (option --branch)"
  else
    hint="aucune branche distante ne le contient : changez l'ExecStart du service ou poussez la branche"
  fi
  die "le service lance $entry, absent de $target_ref (branche serveur : $current_branch) : mise à jour annulée ; $hint"
fi

local_ref="refs/heads/$target_branch"
if git show-ref --verify --quiet "$local_ref"; then
  git merge-base --is-ancestor "$local_ref" "$target_ref" \
    || die "la branche locale $target_branch a divergé de $target_ref (commits locaux ?) : à résoudre à la main"
  incoming=$(git log --oneline "$local_ref..$target_ref")
else
  incoming="(nouvelle branche locale $target_branch, suivant $target_ref)"
fi

if [[ -z "$incoming" && "$target_branch" == "$current_branch" ]]; then
  info "Déjà à jour sur $target_branch : $(git log -1 --format='%h %s')"
  exit "$EXIT_UP_TO_DATE"
fi

[[ "$target_branch" != "$current_branch" ]] && info "Changement de branche : $current_branch -> $target_branch"
if [[ -n "$incoming" ]]; then
  info "Commits à appliquer :"
  echo "$incoming"
fi

if $dry_run; then
  info "Simulation : aucune modification effectuée"
  exit 0
fi

old_head=$(git rev-parse HEAD)

rollback_hint() {
  if [[ "$target_branch" != "$current_branch" ]]; then
    echo "git -C '$app_dir' checkout $current_branch"
  else
    echo "git -C '$app_dir' reset --hard ${old_head:0:7}"
  fi
}

if [[ "$target_branch" != "$current_branch" ]]; then
  if git show-ref --verify --quiet "$local_ref"; then
    git checkout --quiet "$target_branch" || die "impossible d'extraire $target_branch"
  else
    git checkout --quiet --track "$target_ref" || die "impossible de créer la branche $target_branch"
  fi
fi

git merge --ff-only --quiet "$target_ref" || die "git merge --ff-only a échoué"
new_head=$(git rev-parse HEAD)

if ! git diff --quiet "$old_head" "$new_head" -- "${DEPENDENCY_FILES[@]}"; then
  info "Dépendances modifiées : npm install"
  npm install --omit=dev --no-audit --no-fund \
    || die "npm install a échoué. Pour revenir en arrière : $(rollback_hint)"
fi

info "Vérification syntaxique (node --check src/*.js)"
while IFS= read -r -d '' js_file; do
  node --check "$js_file" \
    || die "erreur de syntaxe dans $js_file. Pour revenir en arrière : $(rollback_hint)"
done < <(find src -name '*.js' -print0)

info "Mis à jour : ${old_head:0:7} -> ${new_head:0:7} ($target_branch)"
info "En cas de problème, retour arrière : $(rollback_hint)"
