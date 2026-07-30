#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

usage() {
  cat <<'EOF'
Usage:
  verify-dual-local.sh [--run] [--keep]

Default mode is a dry-run. --run creates two disposable local Docker projects,
mini-verify-test and mini-verify-production, with separate SQL Server volumes,
databases, networks, bind directories and loopback ports. It explicitly runs
database initialization and the existing general schema migration only inside
those disposable local databases.

--keep leaves the two local projects and volumes running after a successful
verification. Without --keep, the script removes only its own disposable
containers, networks and named volumes.

This script never connects to a remote host or remote database.
EOF
}

run=false
keep=false

while (($#)); do
  case "$1" in
    --run)
      run=true
      shift
      ;;
    --keep)
      keep=true
      shift
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

if [[ "${run}" == false ]]; then
  info "DRY-RUN：不会访问 Docker daemon、网络或数据库"
  cat <<'EOF'
  1. 生成仅存在于临时目录的 test/production 本地环境文件。
  2. 为两个环境分别构建 Backend、Admin、EAP 镜像。
  3. 分别显式启动 SQL Server、运行 db-init、运行通用 schema migration。
  4. 普通 compose up 启动应用，并确认未隐式执行数据库 job。
  5. 校验 8 个健康端点、生产安全开关、数据库名、网络、volume 和 OCI SHA label。
  6. 停止 test Backend，确认 production Backend 仍健康，再恢复 test。
  7. 默认删除且仅删除 mini-verify-* 临时项目和 volume。
EOF
  info "实际执行请追加 --run；保留环境可再追加 --keep"
  exit 0
fi

require_command curl
require_command docker
require_command git
require_command openssl

docker info >/dev/null 2>&1 || die "Docker daemon 不可用"

head_sha="$(git -C "${REPO_ROOT}" rev-parse --verify HEAD)"
[[ "${head_sha}" =~ ^[0-9a-f]{40}$ ]] || die "无法读取完整 Git HEAD"
local_version="local-verify-${head_sha:0:12}"
local_revision="worktree-${head_sha:0:12}"

case "$(uname -m)" in
  arm64|aarch64)
    mssql_image="mcr.microsoft.com/azure-sql-edge:latest"
    mssql_platform="linux/arm64"
    ;;
  x86_64|amd64)
    mssql_image="mcr.microsoft.com/mssql/server:2022-latest"
    mssql_platform="linux/amd64"
    ;;
  *)
    die "不支持的本机架构：$(uname -m)"
    ;;
esac

tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/mini-dual-verify.XXXXXX")"
data_root="${tmp_root}/data"
test_env="${tmp_root}/test.env"
production_env="${tmp_root}/production.env"
test_project="mini-verify-test"
production_project="mini-verify-production"
cleanup_required=true

compose_test=(
  docker compose
  --project-name "${test_project}"
  --file "${DEPLOY_ROOT}/compose.yml"
  --file "${DEPLOY_ROOT}/compose.test.yml"
  --env-file "${test_env}"
)
compose_production=(
  docker compose
  --project-name "${production_project}"
  --file "${DEPLOY_ROOT}/compose.yml"
  --file "${DEPLOY_ROOT}/compose.production.yml"
  --env-file "${production_env}"
)

cleanup() {
  local exit_code=$?
  if [[ "${cleanup_required}" == true ]]; then
    "${compose_test[@]}" down --timeout 5 --volumes --remove-orphans \
      >/dev/null 2>&1 || true
    "${compose_production[@]}" down --timeout 5 --volumes --remove-orphans \
      >/dev/null 2>&1 || true
    rm -rf -- "${tmp_root}"
  fi
  exit "${exit_code}"
}
trap cleanup EXIT

for project in "${test_project}" "${production_project}"; do
  if [[ -n "$(docker ps -aq --filter "label=com.docker.compose.project=${project}")" ]]; then
    die "发现已有 ${project} 容器；为避免干扰，先人工处理该一次性验证项目"
  fi
done

mkdir -p \
  "${data_root}/test/backups" \
  "${data_root}/test/uploads" \
  "${data_root}/test/assessment-data" \
  "${data_root}/test/assessment-assets" \
  "${data_root}/production/backups" \
  "${data_root}/production/uploads" \
  "${data_root}/production/assessment-data" \
  "${data_root}/production/assessment-assets"
chmod -R 0777 "${data_root}"

sa_password="LocalDual_$(openssl rand -hex 12)!Aa1"
jwt_test="$(openssl rand -hex 32)"
jwt_production="$(openssl rand -hex 32)"
share_test="$(openssl rand -hex 32)"
share_production="$(openssl rand -hex 32)"

write_env() {
  local destination="$1"
  local environment="$2"
  local database_name="$3"
  local environment_data_root="$4"
  local jwt_secret="$5"
  local share_secret="$6"
  local eap_url="$7"
  local admin_url="$8"
  local dev_login="$9"
  local simulated_payment="${10}"
  local docs="${11}"
  local sms_mock="${12}"

  {
    printf 'APP_ENV=%s\n' "${environment}"
    printf 'APP_VERSION=%s\n' "${local_version}"
    printf 'VCS_REF=%s\n' "${local_revision}"
    printf 'IMAGE_TAG=%s\n' "${local_version}"
    printf 'LOG_LEVEL=INFO\n'
    printf 'ENABLE_API_DOCS=%s\n' "${docs}"
    printf 'AUTO_MIGRATE_SCHEMA=false\n'
    printf 'ALLOW_DEV_LOGIN=%s\n' "${dev_login}"
    printf 'ALLOW_SIMULATED_PAYMENT=%s\n' "${simulated_payment}"
    printf 'MSSQL_IMAGE=%s\n' "${mssql_image}"
    printf 'MSSQL_PLATFORM=%s\n' "${mssql_platform}"
    printf 'MSSQL_PID=Developer\n'
    printf 'MSSQL_SA_PASSWORD=%s\n' "${sa_password}"
    printf 'MIGRATION_DB_USER=sa\n'
    printf 'MIGRATION_DB_PASSWORD=%s\n' "${sa_password}"
    # Disposable local verification intentionally uses sa. Runtime preflight
    # rejects this for real deployed environments.
    printf 'DB_USER=sa\n'
    printf 'DB_PASSWORD=%s\n' "${sa_password}"
    printf 'DB_NAME=%s\n' "${database_name}"
    printf 'DB_CONNECT_TIMEOUT=5\n'
    printf 'SKIP_LEGACY_QUERIES=true\n'
    printf 'BACKEND_WORKERS=1\n'
    printf 'JWT_SECRET=%s\n' "${jwt_secret}"
    printf 'JWT_ALGORITHM=HS256\n'
    printf 'JWT_EXPIRATION_HOURS=168\n'
    printf 'ASSESSMENT_SHARE_SECRET=%s\n' "${share_secret}"
    printf 'ASSESSMENT_CONSENT_VERSION=2026-01\n'
    printf 'MESSAGE_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 24)"
    printf 'BASE_URL=%s\n' "${eap_url}"
    printf 'ASSESSMENT_FRONTEND_BASE_URL=%s\n' "${eap_url}"
    printf 'CORS_ALLOWED_ORIGINS=%s,%s\n' "${eap_url}" "${admin_url}"
    printf 'ADMIN_PUBLIC_API_BASE_URL=%s\n' "${admin_url}"
    printf 'EAP_PUBLIC_API_BASE_URL=%s\n' "${eap_url}"
    printf 'EAP_PUBLIC_SITE_URL=%s\n' "${eap_url}"
    printf 'NEXT_PUBLIC_DATA_SOURCE=mock\n'
    printf 'WECHAT_APPID=\n'
    printf 'WECHAT_SECRET=\n'
    printf 'WECHAT_MINIPROGRAM_STATE=developer\n'
    printf 'WECHAT_PAY_MCH_ID=\n'
    printf 'WECHAT_PAY_KEY=\n'
    printf 'WECHAT_PAY_NOTIFY_URL=%s/api/payment/wechat/callback\n' "${eap_url}"
    printf 'SMS_MOCK=%s\n' "${sms_mock}"
    printf 'SMS_CODE_LENGTH=6\n'
    printf 'SMS_CODE_TTL_MINUTES=5\n'
    printf 'SMS_RESEND_INTERVAL_SECONDS=60\n'
    printf 'SYSLOG_ADDRESS=udp://127.0.0.1:5514\n'
    printf 'UPLOAD_HOST_DIR=%s/uploads\n' "${environment_data_root}"
    printf 'ASSESSMENT_DATA_HOST_DIR=%s/assessment-data\n' "${environment_data_root}"
    printf 'ASSESSMENT_ASSET_HOST_DIR=%s/assessment-assets\n' "${environment_data_root}"
    printf 'MSSQL_BACKUP_HOST_DIR=%s/backups\n' "${environment_data_root}"
  } >"${destination}"
  chmod 0600 "${destination}"
}

write_env \
  "${test_env}" test lxxlBuild_verify_test "${data_root}/test" \
  "${jwt_test}" "${share_test}" \
  https://test.eap.ji-psy.com https://test.admin.ji-psy.com \
  true true true true
write_env \
  "${production_env}" production lxxlBuild_verify_production \
  "${data_root}/production" "${jwt_production}" "${share_production}" \
  https://eap.ji-psy.com https://admin.ji-psy.com \
  false false false false

start_environment() {
  local label="$1"
  shift
  local -a compose=("$@")

  info "${label}：渲染并构建三个应用镜像"
  "${compose[@]}" config --quiet
  "${compose[@]}" build --quiet backend admin eap

  info "${label}：显式启动本地 SQL Server"
  "${compose[@]}" up -d --wait --wait-timeout 300 mssql
  info "${label}：显式建库"
  "${compose[@]}" --profile database-init run --rm --no-deps db-init
  info "${label}：显式运行通用 schema migration"
  "${compose[@]}" --profile database-init run --rm --no-deps migrate

  info "${label}：普通 up 启动应用（不会执行 database-init profile）"
  "${compose[@]}" up -d --wait --wait-timeout 300
}

start_environment test "${compose_test[@]}"
start_environment production "${compose_production[@]}"

assert_status() {
  local expected="$1"
  local url="$2"
  local actual=""
  local attempt
  for attempt in {1..30}; do
    actual="$(
      curl --silent --show-error --output /dev/null \
        --write-out '%{http_code}' --max-time 10 "${url}" 2>/dev/null || true
    )"
    [[ "${actual}" == "${expected}" ]] && break
    sleep 1
  done
  [[ "${actual}" == "${expected}" ]] \
    || die "${url} 期望 HTTP ${expected}，实际 ${actual}"
  info "HTTP ${actual} ${url}"
}

for url in \
  http://127.0.0.1:18000/health/live \
  http://127.0.0.1:18000/health/ready \
  http://127.0.0.1:13001/health \
  http://127.0.0.1:13000/health \
  http://127.0.0.1:28000/health/live \
  http://127.0.0.1:28000/health/ready \
  http://127.0.0.1:23001/health \
  http://127.0.0.1:23000/health; do
  assert_status 200 "${url}"
done
assert_status 200 http://127.0.0.1:18000/docs
assert_status 404 http://127.0.0.1:28000/docs

login_status="$(
  curl --silent --show-error --output /dev/null \
    --write-out '%{http_code}' --max-time 10 \
    --header 'Content-Type: application/json' \
    --data '{"code":"dev_admin"}' \
    http://127.0.0.1:28000/api/mini/auth/login
)"
[[ "${login_status}" == "403" ]] \
  || die "production 开发登录应返回 403，实际 ${login_status}"

database_name() {
  local expected="$1"
  shift
  local -a compose=("$@")
  local actual
  actual="$(
    "${compose[@]}" exec -T backend python -c \
      'import os, pyodbc; c=pyodbc.connect("DRIVER={"+os.environ["DB_DRIVER"]+"};SERVER="+os.environ["DB_SERVER"]+","+os.environ["DB_PORT"]+";DATABASE="+os.environ["DB_NAME"]+";UID="+os.environ["DB_USER"]+";PWD="+os.environ["DB_PASSWORD"]+";Encrypt=yes;TrustServerCertificate=yes"); print(c.cursor().execute("SELECT DB_NAME()").fetchone()[0]); c.close()'
  )"
  [[ "${actual}" == "${expected}" ]] \
    || die "数据库隔离失败：期望 ${expected}，实际 ${actual}"
  info "数据库：${actual}"
}

database_name lxxlBuild_verify_test "${compose_test[@]}"
database_name lxxlBuild_verify_production "${compose_production[@]}"

docker network inspect "${test_project}_app" >/dev/null
docker network inspect "${production_project}_app" >/dev/null
docker volume inspect "${test_project}_mssql-data" >/dev/null
docker volume inspect "${production_project}_mssql-data" >/dev/null

for environment in test production; do
  for service in backend admin eap; do
    image="mini-${environment}-${service}:${local_version}"
    revision="$(
      docker image inspect \
        --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
        "${image}"
    )"
    [[ "${revision}" == "${local_revision}" ]] \
      || die "${image} OCI revision 不匹配：${revision}"
  done
done

info "隔离故障演练：停止 test Backend"
"${compose_test[@]}" stop backend
assert_status 200 http://127.0.0.1:28000/health/ready
"${compose_test[@]}" start backend
assert_status 200 http://127.0.0.1:18000/health/ready

if [[ "${keep}" == true ]]; then
  cleanup_required=false
  info "双环境本地验证通过；按 --keep 保留运行中的项目"
  info "临时环境文件保留于：${tmp_root}"
  info "验收完成后分别使用其中的 test.env/production.env 执行 down --volumes"
else
  info "双环境本地验证通过；正在清理 mini-verify-* 一次性资源"
fi
