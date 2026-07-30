#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

usage() {
  cat <<'EOF'
Usage:
  restore-check.sh --environment test|production --backup FILE.bak [--execute]

Default behavior is a dry-run. --execute runs SQL Server RESTORE VERIFYONLY
WITH CHECKSUM after exact confirmation. It does not restore or overwrite a
database; a real isolated scratch restore is still required periodically.

Non-interactive confirmation:
  OPS_CONFIRMATION="VERIFY RESTORE <environment> <file>"
EOF
}

environment=""
backup_name=""
execute=false
compose_file="${COMPOSE_FILE:-}"
override_file="${COMPOSE_OVERRIDE_FILE:-}"
env_file="${ENV_FILE:-}"
container_backup_dir="${MSSQL_BACKUP_CONTAINER_DIR:-/var/opt/mssql/backup}"

while (($#)); do
  case "$1" in
    --environment)
      [[ $# -ge 2 ]] || die "--environment 缺少值"
      environment="$2"
      shift 2
      ;;
    --backup)
      [[ $# -ge 2 ]] || die "--backup 缺少值"
      backup_name="$2"
      shift 2
      ;;
    --execute)
      execute=true
      shift
      ;;
    --compose-file)
      [[ $# -ge 2 ]] || die "--compose-file 缺少值"
      compose_file="$2"
      shift 2
      ;;
    --override-file)
      [[ $# -ge 2 ]] || die "--override-file 缺少值"
      override_file="$2"
      shift 2
      ;;
    --env-file)
      [[ $# -ge 2 ]] || die "--env-file 缺少值"
      env_file="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "未知参数：$1"
      ;;
  esac
done

environment="$(normalize_environment "${environment}")"
validate_backup_name "${backup_name}"
compose_file="${compose_file:-$(find_compose_file)}"
override_file="${override_file:-$(default_compose_override_for "${environment}")}"
env_file="${env_file:-$(default_env_file_for "${environment}")}"
project_name="$(project_name_for "${environment}")"
container_backup_path="${container_backup_dir}/${backup_name}"

compose=(
  docker compose
  --project-name "${project_name}"
  --file "${compose_file}"
  --file "${override_file}"
  --env-file "${env_file}"
)

if [[ "${execute}" == false ]]; then
  info "DRY-RUN：不会访问 Docker daemon 或数据库"
  info "将校验：${container_backup_path}"
  print_command "${compose[@]}" exec -T mssql \
    "<sqlcmd: RESTORE VERIFYONLY WITH CHECKSUM>"
  info "执行校验需追加 --execute 并确认：VERIFY RESTORE ${environment} ${backup_name}"
  exit 0
fi

require_command docker
[[ -f "${compose_file}" ]] || die "缺少 Compose 文件：${compose_file}"
[[ -f "${override_file}" ]] || die "缺少 Compose 覆盖文件：${override_file}"
[[ -f "${env_file}" ]] || die "缺少环境文件：${env_file}"
"${compose[@]}" config --quiet

container_id="$("${compose[@]}" ps -q mssql)"
[[ -n "${container_id}" ]] || die "mssql 服务未运行"
if ! docker inspect --format '{{range .Mounts}}{{println .Destination}}{{end}}' \
  "${container_id}" | grep -Fxq "${container_backup_dir}"; then
  die "mssql 未挂载独立备份目录 ${container_backup_dir}"
fi

confirm_exact "VERIFY RESTORE ${environment} ${backup_name}"

"${compose[@]}" exec -T mssql /bin/bash -ceu '
  source_file="$1"
  [[ -r "$source_file" ]] || {
    echo "backup file is not readable: $source_file" >&2
    exit 1
  }
  if [[ -x /opt/mssql-tools18/bin/sqlcmd ]]; then
    sqlcmd=/opt/mssql-tools18/bin/sqlcmd
  elif [[ -x /opt/mssql-tools/bin/sqlcmd ]]; then
    sqlcmd=/opt/mssql-tools/bin/sqlcmd
  else
    echo "sqlcmd not found" >&2
    exit 1
  fi
  if [[ -n "${MSSQL_SA_PASSWORD:-}" ]]; then
    export SQLCMDPASSWORD="${MSSQL_SA_PASSWORD}"
  elif [[ -r "${MSSQL_SA_PASSWORD_FILE:-/run/secrets/mssql_sa_password}" ]]; then
    export SQLCMDPASSWORD
    SQLCMDPASSWORD="$(cat "${MSSQL_SA_PASSWORD_FILE:-/run/secrets/mssql_sa_password}")"
  else
    echo "MSSQL credential is unavailable inside the container" >&2
    exit 1
  fi
  "$sqlcmd" -S localhost -U sa -C -b -Q \
    "RESTORE VERIFYONLY FROM DISK = N'\''$source_file'\'' WITH CHECKSUM"
' -- "${container_backup_path}"

info "RESTORE VERIFYONLY 通过：${backup_name}"
warn "VERIFYONLY 不能替代在隔离实例中执行完整恢复和业务校验"
