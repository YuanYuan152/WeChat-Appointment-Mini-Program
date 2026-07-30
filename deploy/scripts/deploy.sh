#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

usage() {
  cat <<'EOF'
Usage:
  deploy.sh --environment test|production [options]

Default behavior is a dry-run that prints the intended commands and changes
nothing. --apply is required for Docker changes.

Options:
  --environment NAME       Required: test or production
  --apply                  Execute the deployment after exact confirmation
  --build                  Build images before starting application services
  --include-database       Allow starting the mssql service (extra confirmation)
  --initialize-database    Run one-time db-init (requires --include-database)
  --migrate                Run general and controlled assessment migrations
                           (extra confirmation)
  --provision-runtime-db-user
                           Create the least-privilege Backend DB identity
                           (first deployment only; extra confirmation)
  --skip-smoke             Do not run post-deploy public smoke checks
  --compose-file PATH      Base Compose file
  --override-file PATH     Environment Compose override
  --env-file PATH          Real environment file
  -h, --help

Non-interactive confirmations:
  OPS_CONFIRMATION="DEPLOY <environment>"
  DATABASE_CONFIRMATION="START DATABASE <environment>"
  DB_INIT_CONFIRMATION="INITIALIZE DATABASE <environment>"
  MIGRATION_CONFIRMATION="MIGRATE DATABASE <environment>"
  DB_USER_PROVISION_CONFIRMATION="PROVISION DATABASE USER <environment>"
EOF
}

environment=""
apply=false
build=false
include_database=false
initialize_database=false
run_migrations=false
provision_runtime_db_user=false
skip_smoke=false
compose_file="${COMPOSE_FILE:-}"
override_file="${COMPOSE_OVERRIDE_FILE:-}"
env_file="${ENV_FILE:-}"

while (($#)); do
  case "$1" in
    --environment)
      [[ $# -ge 2 ]] || die "--environment 缺少值"
      environment="$2"
      shift 2
      ;;
    --apply)
      apply=true
      shift
      ;;
    --build)
      build=true
      shift
      ;;
    --include-database)
      include_database=true
      shift
      ;;
    --initialize-database)
      initialize_database=true
      shift
      ;;
    --migrate)
      run_migrations=true
      shift
      ;;
    --provision-runtime-db-user)
      provision_runtime_db_user=true
      shift
      ;;
    --skip-smoke)
      skip_smoke=true
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
compose_file="${compose_file:-$(find_compose_file)}"
override_file="${override_file:-$(default_compose_override_for "${environment}")}"
env_file="${env_file:-$(default_env_file_for "${environment}")}"
project_name="$(project_name_for "${environment}")"

[[ "${initialize_database}" == false || "${include_database}" == true ]] \
  || die "--initialize-database 必须与 --include-database 一起使用"

compose=(
  docker compose
  --project-name "${project_name}"
  --file "${compose_file}"
  --file "${override_file}"
  --env-file "${env_file}"
)
app_services=(backend admin eap)
wait_timeout="${DEPLOY_WAIT_TIMEOUT:-180}"
expected_version=""
database_name=""
if [[ -f "${env_file}" ]]; then
  expected_version="$(read_env_value APP_VERSION "${env_file}")"
  database_name="$(read_env_value DB_NAME "${env_file}")"
fi

smoke_command=("${SCRIPT_DIR}/smoke.sh" --environment "${environment}")
if [[ -n "${expected_version}" ]]; then
  smoke_command+=(--expected-version "${expected_version}")
fi
smoke_command+=(--run)

if [[ "${apply}" == false ]]; then
  info "DRY-RUN：不会访问 Docker daemon、网络或数据库"
  info "环境：${environment}；Compose project：${project_name}"
  info "基础 Compose：${compose_file}"
  info "覆盖 Compose：${override_file}"
  info "环境文件：${env_file}"
  print_command "${SCRIPT_DIR}/preflight.sh" \
    --environment "${environment}" --runtime \
    --compose-file "${compose_file}" \
    --override-file "${override_file}" \
    --env-file "${env_file}"
  print_command "${compose[@]}" config --quiet
  if [[ "${build}" == true ]]; then
    print_command "${compose[@]}" build "${app_services[@]}"
  fi
  if [[ "${include_database}" == true ]]; then
    info "需要额外确认：START DATABASE ${environment}"
    print_command "${compose[@]}" up -d --wait --wait-timeout "${wait_timeout}" mssql
  fi
  if [[ "${initialize_database}" == true ]]; then
    info "需要额外确认：INITIALIZE DATABASE ${environment}"
    print_command "${compose[@]}" run --rm db-init
  fi
  if [[ "${run_migrations}" == true ]]; then
    info "需要额外确认：MIGRATE DATABASE ${environment}"
    print_command "${compose[@]}" run --rm --no-deps migrate \
      python migrate_assessment_tables.py --preflight
    print_command "${compose[@]}" run --rm --no-deps migrate
    print_command "${compose[@]}" run --rm --no-deps migrate \
      python migrate_assessment_tables.py --apply \
      --confirm-database "${database_name:-<DB_NAME>}"
  fi
  if [[ "${provision_runtime_db_user}" == true ]]; then
    info "需要额外确认：PROVISION DATABASE USER ${environment}"
    print_command "${compose[@]}" run --rm --no-deps migrate \
      python provision_runtime_db_user.py
    print_command "${compose[@]}" run --rm --no-deps migrate \
      python provision_runtime_db_user.py --apply \
      --confirm-database "${database_name:-<DB_NAME>}"
  fi
  print_command "${compose[@]}" up -d --no-deps --no-build --wait \
    --wait-timeout "${wait_timeout}" "${app_services[@]}"
  if [[ "${skip_smoke}" == false ]]; then
    print_command "${smoke_command[@]}"
  fi
  info "执行部署需追加 --apply，并逐项输入精确确认短语"
  exit 0
fi

"${SCRIPT_DIR}/preflight.sh" \
  --environment "${environment}" \
  --runtime \
  --compose-file "${compose_file}" \
  --override-file "${override_file}" \
  --env-file "${env_file}"

confirm_exact "DEPLOY ${environment}"

"${compose[@]}" config --quiet
expected_version="$(read_env_value APP_VERSION "${env_file}")"
[[ -n "${expected_version}" ]] || die "环境文件缺少 APP_VERSION"
database_name="$(read_env_value DB_NAME "${env_file}")"
[[ -n "${database_name}" ]] || die "环境文件缺少 DB_NAME"
smoke_command=(
  "${SCRIPT_DIR}/smoke.sh"
  --environment "${environment}"
  --expected-version "${expected_version}"
  --run
)

if [[ "${build}" == true ]]; then
  "${compose[@]}" build "${app_services[@]}"
fi

if [[ "${include_database}" == true ]]; then
  OPS_CONFIRMATION="${DATABASE_CONFIRMATION:-}" \
    confirm_exact "START DATABASE ${environment}"
  "${compose[@]}" up -d --wait --wait-timeout "${wait_timeout}" mssql
fi

if [[ "${initialize_database}" == true ]]; then
  OPS_CONFIRMATION="${DB_INIT_CONFIRMATION:-}" \
    confirm_exact "INITIALIZE DATABASE ${environment}"
  "${compose[@]}" run --rm db-init
fi

if [[ "${run_migrations}" == true ]]; then
  OPS_CONFIRMATION="${MIGRATION_CONFIRMATION:-}" \
    confirm_exact "MIGRATE DATABASE ${environment}"
  # --no-deps is mandatory: migrate depends on db-init in Compose, but a
  # schema migration must never initialize a database implicitly.
  # Run the controlled assessment preflight before the general migration so
  # existing drift blocks the operation before any DDL is attempted.
  "${compose[@]}" run --rm --no-deps migrate \
    python migrate_assessment_tables.py --preflight
  "${compose[@]}" run --rm --no-deps migrate
  "${compose[@]}" run --rm --no-deps migrate \
    python migrate_assessment_tables.py --apply \
    --confirm-database "${database_name}"
fi

if [[ "${provision_runtime_db_user}" == true ]]; then
  OPS_CONFIRMATION="${DB_USER_PROVISION_CONFIRMATION:-}" \
    confirm_exact "PROVISION DATABASE USER ${environment}"
  # The first invocation is an offline plan and is intentionally retained in
  # the apply path.  The second command is the only one that opens a database
  # connection; the runtime password is read from container environment only.
  "${compose[@]}" run --rm --no-deps migrate \
    python provision_runtime_db_user.py
  "${compose[@]}" run --rm --no-deps migrate \
    python provision_runtime_db_user.py --apply \
    --confirm-database "${database_name}"
fi

# --no-deps prevents an ordinary application deploy from implicitly creating,
# initializing or replacing a database service.
"${compose[@]}" up -d --no-deps --no-build --wait \
  --wait-timeout "${wait_timeout}" "${app_services[@]}"

if [[ "${skip_smoke}" == false ]]; then
  "${smoke_command[@]}"
fi

info "${environment} 应用部署完成；数据库未自动初始化或迁移"
