#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

usage() {
  cat <<'EOF'
Usage:
  backup-mssql.sh --environment test|production --database NAME [options]

Default behavior is a dry-run. --execute performs a SQL Server COPY_ONLY,
CHECKSUM and COMPRESSION backup after exact confirmation.

Options:
  --output-name FILE.bak  Override generated filename
  --execute               Execute the backup
  --compose-file PATH
  --override-file PATH
  --env-file PATH

Non-interactive confirmation:
  OPS_CONFIRMATION="BACKUP <environment> <database>"
EOF
}

environment=""
database=""
output_name=""
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
    --database)
      [[ $# -ge 2 ]] || die "--database 缺少值"
      database="$2"
      shift 2
      ;;
    --output-name)
      [[ $# -ge 2 ]] || die "--output-name 缺少值"
      output_name="$2"
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
validate_identifier "${database}" "数据库名"
if [[ -z "${output_name}" ]]; then
  output_name="${environment}-${database}-$(date -u +%Y%m%dT%H%M%SZ).bak"
fi
validate_backup_name "${output_name}"

compose_file="${compose_file:-$(find_compose_file)}"
override_file="${override_file:-$(default_compose_override_for "${environment}")}"
env_file="${env_file:-$(default_env_file_for "${environment}")}"
project_name="$(project_name_for "${environment}")"
container_backup_path="${container_backup_dir}/${output_name}"

compose=(
  docker compose
  --project-name "${project_name}"
  --file "${compose_file}"
  --file "${override_file}"
  --env-file "${env_file}"
)

if [[ "${execute}" == false ]]; then
  info "DRY-RUN：不会访问 Docker daemon 或数据库，也不会创建备份文件"
  info "环境：${environment}"
  info "数据库：${database}"
  info "容器内备份目标：${container_backup_path}"
  print_command "${compose[@]}" exec -T mssql \
    "<sqlcmd: BACKUP DATABASE WITH COPY_ONLY, CHECKSUM, COMPRESSION>"
  info "执行备份需追加 --execute 并确认：BACKUP ${environment} ${database}"
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
  die "mssql 未挂载独立备份目录 ${container_backup_dir}；拒绝写入容器临时层"
fi

confirm_exact "BACKUP ${environment} ${database}"

"${compose[@]}" exec -T mssql /bin/bash -ceu '
  database="$1"
  destination="$2"
  if [[ -e "$destination" ]]; then
    echo "backup destination already exists; refusing to overwrite: $destination" >&2
    exit 1
  fi
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
    "BACKUP DATABASE [$database] TO DISK = N'\''$destination'\'' WITH COPY_ONLY, CHECKSUM, COMPRESSION, INIT, STATS = 10"
' -- "${database}" "${container_backup_path}"

info "备份完成：${container_backup_path}"
warn "还需把宿主备份复制到异机/对象存储，并按计划执行恢复校验"
