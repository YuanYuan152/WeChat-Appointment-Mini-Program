#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

usage() {
  cat <<'EOF'
Usage:
  preflight.sh --environment test|production [options]

Read-only by design. The default mode validates repository-local deployment
files only. --runtime adds host, Docker, DNS and TLS checks.

Options:
  --environment NAME     Required: test or production
  --runtime              Run deployment-host checks (still read-only)
  --expected-branch NAME Require this release branch (default: EXPECTED_BRANCH
                         or dev; runtime mode only)
  --compose-file PATH    Base Compose file
  --override-file PATH   Environment Compose override
  --env-file PATH        Real environment file
  --allow-dirty          Permit a dirty Git worktree (strongly discouraged)
  --skip-dns             Skip DNS checks in runtime mode
  --skip-tls             Skip certificate/SAN checks in runtime mode
  --public-ip ADDRESS    Require both environment domains to resolve here
  -h, --help
EOF
}

environment=""
runtime=false
allow_dirty=false
skip_dns=false
skip_tls=false
public_ip="${DEPLOY_PUBLIC_IP:-}"
expected_branch="${EXPECTED_BRANCH:-dev}"
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
    --runtime)
      runtime=true
      shift
      ;;
    --expected-branch)
      [[ $# -ge 2 ]] || die "--expected-branch 缺少值"
      expected_branch="$2"
      shift 2
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
    --allow-dirty)
      allow_dirty=true
      shift
      ;;
    --skip-dns)
      skip_dns=true
      shift
      ;;
    --skip-tls)
      skip_tls=true
      shift
      ;;
    --public-ip)
      [[ $# -ge 2 ]] || die "--public-ip 缺少值"
      public_ip="$2"
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
read -r eap_domain admin_domain <<<"$(default_domains_for "${environment}")"

failures=0

check_file() {
  local path="$1"
  local label="$2"
  if [[ -f "${path}" ]]; then
    info "${label}：${path}"
  else
    warn "缺少${label}：${path}"
    failures=$((failures + 1))
  fi
}

check_file "${DEPLOY_ROOT}/nginx/mini-program.conf" "Nginx 配置"
check_file "${DEPLOY_ROOT}/nginx/mini-program-http-bootstrap.conf" "Nginx TLS 引导配置"
check_file "${DEPLOY_ROOT}/rsyslog/30-mini-program.conf" "rsyslog 配置"
check_file "${DEPLOY_ROOT}/logrotate/mini-program" "logrotate 配置"
check_file "${DEPLOY_ROOT}/OPERATIONS.md" "运维文档"
check_file "${SCRIPT_DIR}/nginx-server-name-count.awk" "Nginx server_name 计数脚本"

while IFS= read -r script; do
  if ! bash -n "${script}"; then
    warn "Shell 语法检查失败：${script}"
    failures=$((failures + 1))
  fi
done < <(find "${SCRIPT_DIR}" -maxdepth 1 -type f -name '*.sh' -print | sort)

for expected in \
  "server_name eap.ji-psy.com" \
  "server_name admin.ji-psy.com" \
  "server_name test.eap.ji-psy.com" \
  "server_name test.admin.ji-psy.com" \
  "127.0.0.1:28000" \
  "127.0.0.1:23001" \
  "127.0.0.1:23000" \
  "127.0.0.1:18000" \
  "127.0.0.1:13001" \
  "127.0.0.1:13000"; do
  if ! grep -Fq "${expected}" "${DEPLOY_ROOT}/nginx/mini-program.conf"; then
    warn "Nginx 配置缺少预期项：${expected}"
    failures=$((failures + 1))
  fi
done

for expected in daily dateext compress "rotate 30" "maxage 30"; do
  if ! grep -Fq "${expected}" "${DEPLOY_ROOT}/logrotate/mini-program"; then
    warn "logrotate 配置缺少预期项：${expected}"
    failures=$((failures + 1))
  fi
done

if [[ "${runtime}" == false ]]; then
  if [[ -f "${compose_file}" && -f "${override_file}" && -f "${env_file}" ]] \
    && command -v docker >/dev/null 2>&1; then
    project_name="$(project_name_for "${environment}")"
    if ! docker compose \
      --project-name "${project_name}" \
      --file "${compose_file}" \
      --file "${override_file}" \
      --env-file "${env_file}" \
      config --quiet; then
      warn "Compose 本地渲染失败"
      failures=$((failures + 1))
    fi
  else
    info "本地模式不要求真实 Compose/env；当前未执行 Compose 渲染"
  fi

  ((failures == 0)) || die "本地预检发现 ${failures} 个问题"
  info "本地预检通过；未访问网络、Docker daemon 或数据库"
  exit 0
fi

require_command docker
require_command curl
require_command git
require_command openssl
require_command nginx

check_file "${compose_file}" "基础 Compose 文件"
check_file "${override_file}" "${environment} Compose 覆盖文件"
check_file "${env_file}" "${environment} 环境文件"
((failures == 0)) || die "运行时预检缺少必要文件"

if ! docker info >/dev/null 2>&1; then
  die "Docker daemon 不可用或当前用户无访问权限"
fi

project_name="$(project_name_for "${environment}")"
if ! docker compose \
  --project-name "${project_name}" \
  --file "${compose_file}" \
  --file "${override_file}" \
  --env-file "${env_file}" \
  config --quiet; then
  die "Compose 渲染失败"
fi

if [[ "${allow_dirty}" == false ]]; then
  git_status="$(git -C "${REPO_ROOT}" status --porcelain)"
  [[ -z "${git_status}" ]] || die "Git 工作树不干净；请先形成可复现提交"
fi

[[ -n "${expected_branch}" ]] || die "EXPECTED_BRANCH 不能为空"
current_branch="$(
  git -C "${REPO_ROOT}" symbolic-ref --quiet --short HEAD 2>/dev/null || true
)"
[[ -n "${current_branch}" ]] || die "发布必须从具名 Git 分支执行，禁止 detached HEAD"
[[ "${current_branch}" == "${expected_branch}" ]] \
  || die "发布分支必须为 ${expected_branch}，当前为 ${current_branch}；本地验证可显式设置 EXPECTED_BRANCH=${current_branch}"

current_head="$(git -C "${REPO_ROOT}" rev-parse --verify HEAD)"
[[ "${current_head}" =~ ^[0-9a-f]{40}$ ]] || die "无法取得完整 Git HEAD"

tracked_secret_files="$(
  git -C "${REPO_ROOT}" ls-files |
    grep -E '^(backend-python|admin-web|EAP_front_site|deploy/env)/\.env($|\.)' |
    grep -Ev '(\.example|\.sample|\.template)$' || true
)"
[[ -z "${tracked_secret_files}" ]] \
  || die "发现被 Git 跟踪的非示例 .env 文件；必须先移除并轮换相关密钥"

mode="$(file_mode "${env_file}")"
[[ "${mode}" =~ ^[0-7]{3,4}$ ]] || die "无法识别环境文件权限：${mode}"
mode_value=$((8#${mode}))
(( (mode_value & 077) == 0 )) \
  || die "环境文件必须禁止 group/other 访问，期望 0600，当前 ${mode}"

required_keys=(
  APP_ENV
  APP_VERSION
  VCS_REF
  IMAGE_TAG
  AUTO_MIGRATE_SCHEMA
  ALLOW_DEV_LOGIN
  ALLOW_SIMULATED_PAYMENT
  CORS_ALLOWED_ORIGINS
  ENABLE_API_DOCS
  SMS_MOCK
  SMS_PROVIDER
  SMS_CODE_LENGTH
  SMS_CODE_TTL_MINUTES
  SMS_RESEND_INTERVAL_SECONDS
  SMS_MAX_SENDS_PER_HOUR
  SMS_MAX_VERIFY_ATTEMPTS
  SMS_CODE_HASH_SECRET
  DB_NAME
  DB_USER
  DB_PASSWORD
  MIGRATION_DB_USER
  MIGRATION_DB_PASSWORD
  JWT_SECRET
  BASE_URL
  ASSESSMENT_FRONTEND_BASE_URL
  ASSESSMENT_SHARE_SECRET
  MSSQL_IMAGE
  MSSQL_SA_PASSWORD
)
for key in "${required_keys[@]}"; do
  if ! grep -Eq "^[[:space:]]*${key}=" "${env_file}"; then
    warn "环境文件缺少 ${key}"
    failures=$((failures + 1))
  fi
done

sms_code_length_value="$(read_env_value SMS_CODE_LENGTH "${env_file}")"
[[ "${sms_code_length_value}" == "6" ]] || {
  warn "SMS_CODE_LENGTH 必须为 6，以匹配两个 Web 前端和腾讯云验证码模板"
  failures=$((failures + 1))
}
for key in \
  SMS_CODE_TTL_MINUTES \
  SMS_RESEND_INTERVAL_SECONDS \
  SMS_MAX_SENDS_PER_HOUR \
  SMS_MAX_VERIFY_ATTEMPTS; do
  value="$(read_env_value "${key}" "${env_file}")"
  [[ "${value}" =~ ^[1-9][0-9]*$ ]] || {
    warn "${key} 必须为正整数"
    failures=$((failures + 1))
  }
done

if grep -Eqi '=(change[-_]?me|replace([-_]?with|[-_]?me)?[^ ]*|your_[^ ]*|example|changeme)([[:space:]]*)$' "${env_file}"; then
  warn "环境文件仍含占位值"
  failures=$((failures + 1))
fi

db_password_value="$(read_env_value DB_PASSWORD "${env_file}")"
db_user_value="$(read_env_value DB_USER "${env_file}")"
migration_db_user_value="$(read_env_value MIGRATION_DB_USER "${env_file}")"
migration_db_password_value="$(read_env_value MIGRATION_DB_PASSWORD "${env_file}")"
mssql_password_value="$(read_env_value MSSQL_SA_PASSWORD "${env_file}")"
if [[ "$(lowercase "${db_user_value}")" == "sa" ]]; then
  warn "Backend 运行时 DB_USER 不得使用 SQL Server sa"
  failures=$((failures + 1))
fi
if [[ -n "${db_password_value}" && "${db_password_value}" == "${mssql_password_value}" ]]; then
  warn "Backend 运行时 DB_PASSWORD 不得复用 MSSQL_SA_PASSWORD"
  failures=$((failures + 1))
fi
if [[ "$(lowercase "${migration_db_user_value}")" == "sa" ]] \
  && [[ "${migration_db_password_value}" != "${mssql_password_value}" ]]; then
  warn "MIGRATION_DB_USER=sa 时 MIGRATION_DB_PASSWORD 必须匹配 MSSQL_SA_PASSWORD"
  failures=$((failures + 1))
fi

app_env_value="$(read_env_value APP_ENV "${env_file}")"
[[ "${app_env_value}" == "${environment}" ]] || {
  warn "APP_ENV 必须与部署环境 ${environment} 一致"
  failures=$((failures + 1))
}

mssql_image_value="$(read_env_value MSSQL_IMAGE "${env_file}")"
if [[ ! "${mssql_image_value}" =~ @sha256:[0-9a-f]{64}$ ]]; then
  warn "MSSQL_IMAGE 必须固定到已审查的 sha256 digest，禁止部署可变 tag"
  failures=$((failures + 1))
fi

app_version_value="$(read_env_value APP_VERSION "${env_file}")"
vcs_ref_value="$(read_env_value VCS_REF "${env_file}")"
image_tag_value="$(read_env_value IMAGE_TAG "${env_file}")"
if [[ ! "${app_version_value}" =~ ^[0-9a-f]{40}$ ]]; then
  warn "APP_VERSION 必须是完整的 40 位 Git SHA"
  failures=$((failures + 1))
fi
if [[ ! "${image_tag_value}" =~ ^[0-9a-f]{40}$ ]]; then
  warn "IMAGE_TAG 必须是完整的 40 位 Git SHA"
  failures=$((failures + 1))
fi
if [[ ! "${vcs_ref_value}" =~ ^[0-9a-f]{40}$ ]]; then
  warn "VCS_REF 必须是完整的 40 位 Git SHA"
  failures=$((failures + 1))
fi
if [[ "${app_version_value}" != "${image_tag_value}" ]] \
  || [[ "${app_version_value}" != "${vcs_ref_value}" ]]; then
  warn "APP_VERSION、VCS_REF 与 IMAGE_TAG 必须完全一致"
  failures=$((failures + 1))
fi
if [[ "${app_version_value}" != "${current_head}" ]]; then
  warn "APP_VERSION/IMAGE_TAG 必须精确对应当前 HEAD ${current_head}"
  failures=$((failures + 1))
fi

auto_migrate_value="$(read_env_value AUTO_MIGRATE_SCHEMA "${env_file}")"
[[ "$(lowercase "${auto_migrate_value}")" == "false" ]] || {
  warn "AUTO_MIGRATE_SCHEMA 必须为 false；迁移只能显式执行"
  failures=$((failures + 1))
}

base_url_value="$(read_env_value BASE_URL "${env_file}")"
assessment_url_value="$(read_env_value ASSESSMENT_FRONTEND_BASE_URL "${env_file}")"
expected_eap_url="https://${eap_domain}"
for value_name in BASE_URL ASSESSMENT_FRONTEND_BASE_URL; do
  if [[ "${value_name}" == "BASE_URL" ]]; then
    current_value="${base_url_value}"
  else
    current_value="${assessment_url_value}"
  fi
  [[ "${current_value}" == "${expected_eap_url}" ]] || {
    warn "${value_name} 必须精确为 ${expected_eap_url}"
    failures=$((failures + 1))
  }
done

cors_value="$(read_env_value CORS_ALLOWED_ORIGINS "${env_file}")"
for required_origin in "https://${eap_domain}" "https://${admin_domain}"; do
  if ! tr ',' '\n' <<<"${cors_value}" |
    sed -E 's/^[[:space:]]+|[[:space:]]+$//g' |
    grep -Fxq "${required_origin}"; then
    warn "CORS_ALLOWED_ORIGINS 缺少 ${required_origin}"
    failures=$((failures + 1))
  fi
done

if [[ "${environment}" == "production" ]]; then
  for key in ALLOW_DEV_LOGIN ALLOW_SIMULATED_PAYMENT ENABLE_API_DOCS; do
    value="$(read_env_value "${key}" "${env_file}")"
    [[ "$(lowercase "${value}")" == "false" ]] || {
      warn "生产环境 ${key} 必须为 false"
      failures=$((failures + 1))
    }
  done

  sms_mock_value="$(read_env_value SMS_MOCK "${env_file}")"
  [[ "$(lowercase "${sms_mock_value}")" == "false" ]] || {
    warn "生产环境 SMS_MOCK 必须为 false"
    failures=$((failures + 1))
  }

  sms_provider_value="$(read_env_value SMS_PROVIDER "${env_file}")"
  [[ "$(lowercase "${sms_provider_value}")" == "tencent" ]] || {
    warn "生产环境 SMS_PROVIDER 必须为 tencent"
    failures=$((failures + 1))
  }

  sms_hash_secret_value="$(read_env_value SMS_CODE_HASH_SECRET "${env_file}")"
  (( ${#sms_hash_secret_value} >= 32 )) || {
    warn "生产环境 SMS_CODE_HASH_SECRET 必须至少 32 个字符且不得复用 JWT_SECRET"
    failures=$((failures + 1))
  }
  [[ "${sms_hash_secret_value}" != "$(read_env_value JWT_SECRET "${env_file}")" ]] || {
    warn "生产环境 SMS_CODE_HASH_SECRET 不得复用 JWT_SECRET"
    failures=$((failures + 1))
  }

  for key in \
    TENCENTCLOUD_SECRET_ID \
    TENCENTCLOUD_SECRET_KEY \
    TENCENT_SMS_REGION \
    TENCENT_SMS_SDK_APP_ID \
    TENCENT_SMS_SIGN_NAME \
    TENCENT_SMS_TEMPLATE_ID; do
    value="$(read_env_value "${key}" "${env_file}")"
    if [[ -z "${value}" ]] \
      || [[ "${value}" =~ ^(REPLACE_|CHANGE_|YOUR_|change-|replace-|your_) ]]; then
      warn "生产短信能力缺少有效 ${key}"
      failures=$((failures + 1))
    fi
  done

  for key in \
    WECHAT_APPID \
    WECHAT_SECRET \
    WECHAT_PAY_MCH_ID \
    WECHAT_PAY_KEY \
    WECHAT_PAY_NOTIFY_URL; do
    value="$(read_env_value "${key}" "${env_file}")"
    if [[ -z "${value}" ]] \
      || [[ "${value}" =~ ^(REPLACE_|CHANGE_|YOUR_|change-|replace-|your_) ]]; then
      warn "生产微信支付能力缺少有效 ${key}"
      failures=$((failures + 1))
    fi
  done
  wechat_notify_value="$(read_env_value WECHAT_PAY_NOTIFY_URL "${env_file}")"
  expected_wechat_notify="https://${eap_domain}/api/payment/wechat/callback"
  [[ "${wechat_notify_value}" == "${expected_wechat_notify}" ]] || {
    warn "WECHAT_PAY_NOTIFY_URL 必须精确为 ${expected_wechat_notify}"
    failures=$((failures + 1))
  }
fi

if [[ "${skip_dns}" == false ]]; then
  for domain in "${eap_domain}" "${admin_domain}"; do
    resolved="$(resolve_host_ipv4 "${domain}")"
    [[ -n "${resolved}" ]] || {
      warn "${domain} 没有可用 A 记录"
      failures=$((failures + 1))
      continue
    }
    if [[ -n "${public_ip}" && "${resolved}" != "${public_ip}" ]]; then
      warn "${domain} 解析为 ${resolved}，不是预期 ${public_ip}"
      failures=$((failures + 1))
    fi
  done
fi

if [[ "${skip_tls}" == false ]]; then
  cert_dir="/etc/letsencrypt/live/eap.ji-psy.com"
  if [[ "${environment}" == "test" ]]; then
    cert_dir="/etc/letsencrypt/live/test.eap.ji-psy.com"
  fi
  cert_file="${cert_dir}/fullchain.pem"
  [[ -r "${cert_file}" ]] || {
    warn "证书不存在或不可读：${cert_file}"
    failures=$((failures + 1))
  }
  if [[ -r "${cert_file}" ]]; then
    cert_text="$(openssl x509 -in "${cert_file}" -noout -ext subjectAltName 2>/dev/null || true)"
    for domain in "${eap_domain}" "${admin_domain}"; do
      grep -Fq "DNS:${domain}" <<<"${cert_text}" || {
        warn "证书 SAN 不包含 ${domain}"
        failures=$((failures + 1))
      }
    done
    if ! openssl x509 -in "${cert_file}" -noout -checkend 2592000 >/dev/null; then
      warn "证书将在 30 天内过期"
      failures=$((failures + 1))
    fi
  fi
fi

if command -v ss >/dev/null 2>&1; then
  if [[ "${environment}" == "test" ]]; then
    expected_ports=(13000 13001 18000)
  else
    expected_ports=(23000 23001 28000)
  fi
  for port in "${expected_ports[@]}"; do
    if ss -lntH "sport = :${port}" 2>/dev/null | grep -q .; then
      info "端口 ${port} 已监听；部署脚本将由 Compose 核对归属"
    else
      info "端口 ${port} 当前空闲"
    fi
  done
fi

if ! "${SCRIPT_DIR}/validate-nginx-candidate.sh" >/dev/null; then
  warn "仓库候选 Nginx 配置未通过隔离语法/重复域名检查"
  failures=$((failures + 1))
fi

nginx_dump="$(nginx -T 2>&1)" || {
  warn "当前主机 Nginx 配置检查失败"
  failures=$((failures + 1))
}
if [[ -n "${nginx_dump:-}" ]]; then
  for domain in \
    eap.ji-psy.com admin.ji-psy.com \
    test.eap.ji-psy.com test.admin.ji-psy.com; do
    active_server_count="$(
      awk -v target="${domain}" \
        -f "${SCRIPT_DIR}/nginx-server-name-count.awk" <<<"${nginx_dump}"
    )"
    if [[ "${active_server_count}" != "2" ]]; then
      warn "系统 Nginx 中 ${domain} 应恰好出现在 HTTP/HTTPS 两个 server_name，当前 ${active_server_count}；请禁用旧站点"
      failures=$((failures + 1))
    fi
  done
fi

((failures == 0)) || die "运行时预检发现 ${failures} 个问题"
info "${environment} 运行时预检通过；未修改服务或数据库"
