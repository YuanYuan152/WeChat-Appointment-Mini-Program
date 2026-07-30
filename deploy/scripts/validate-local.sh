#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

failures=0

assert_contains() {
  local file="$1"
  local expected="$2"
  if ! grep -Fq "${expected}" "${file}"; then
    warn "${file} 缺少：${expected}"
    failures=$((failures + 1))
  fi
}

assert_code_not_contains() {
  local file="$1"
  local unexpected="$2"
  if sed 's/#.*$//' "${file}" | grep -Fq "${unexpected}"; then
    warn "${file} 的有效配置不应包含：${unexpected}"
    failures=$((failures + 1))
  fi
}

assert_count() {
  local file="$1"
  local expected="$2"
  local count="$3"
  local actual
  actual="$(grep -Fc "${expected}" "${file}" || true)"
  if [[ "${actual}" != "${count}" ]]; then
    warn "${file} 中“${expected}”应出现 ${count} 次，实际 ${actual} 次"
    failures=$((failures + 1))
  fi
}

info "检查 Shell 语法"
while IFS= read -r script; do
  if ! bash -n "${script}"; then
    failures=$((failures + 1))
  fi
done < <(find "${SCRIPT_DIR}" -maxdepth 1 -type f -name '*.sh' -print | sort)

info "检查 Nginx server_name 计数脚本的 awk 兼容性"
nginx_server_name_awk="${SCRIPT_DIR}/nginx-server-name-count.awk"
nginx_server_name_fixture='
server_name test.eap.ji-psy.com test.admin.ji-psy.com;
server_name
  test.eap.ji-psy.com
  example.invalid;
server_name example.invalid;
'
awk_implementations=(awk)
if command -v mawk >/dev/null 2>&1; then
  awk_implementations+=(mawk)
fi
for awk_implementation in "${awk_implementations[@]}"; do
  if ! actual_count="$(
    "${awk_implementation}" -v target="test.eap.ji-psy.com" \
      -f "${nginx_server_name_awk}" <<<"${nginx_server_name_fixture}"
  )"; then
    warn "${awk_implementation} 无法执行 Nginx server_name 计数脚本"
    failures=$((failures + 1))
  elif [[ "${actual_count}" != "2" ]]; then
    warn "${awk_implementation} 的 Nginx server_name 计数结果应为 2，实际 ${actual_count}"
    failures=$((failures + 1))
  fi
done

provision_script="${REPO_ROOT}/backend-python/provision_runtime_db_user.py"
provision_test="${REPO_ROOT}/backend-python/test_provision_runtime_db_user.py"

info "检查数据库迁移与最小权限运行账户门禁"
assert_contains "${DEPLOY_ROOT}/compose.yml" 'RUNTIME_DB_USER: "${DB_USER:?DB_USER is required}"'
assert_contains "${DEPLOY_ROOT}/compose.yml" 'RUNTIME_DB_PASSWORD: "${DB_PASSWORD:?DB_PASSWORD is required}"'
assert_contains "${SCRIPT_DIR}/deploy.sh" 'python migrate_assessment_tables.py --preflight'
assert_contains "${SCRIPT_DIR}/deploy.sh" 'python migrate_assessment_tables.py --apply'
assert_contains "${SCRIPT_DIR}/deploy.sh" 'python provision_runtime_db_user.py --apply'
assert_contains "${SCRIPT_DIR}/verify-dual-local.sh" 'python migrate_assessment_tables.py --apply'
assert_contains "${SCRIPT_DIR}/verify-dual-local.sh" 'python provision_runtime_db_user.py --apply'
assert_contains "${provision_script}" 'RUNTIME_DB_PASSWORD'
assert_contains "${provision_script}" 'refusing silent reuse'
assert_contains "${provision_script}" 'GRANT SELECT, INSERT, UPDATE, DELETE'
assert_code_not_contains "${provision_script}" '"--password"'

if command -v python3 >/dev/null 2>&1; then
  if ! python3 "${provision_script}" >/dev/null; then
    warn "最小权限运行账户脚本默认 dry-run 失败"
    failures=$((failures + 1))
  fi
  if ! (
    cd "${REPO_ROOT}/backend-python"
    python3 -m unittest -q "$(basename "${provision_test}" .py)"
  ); then
    warn "最小权限运行账户单元测试失败"
    failures=$((failures + 1))
  fi
  if ! python3 -c \
    'import pathlib, sys; path = pathlib.Path(sys.argv[1]); compile(path.read_text(encoding="utf-8"), str(path), "exec")' \
    "${REPO_ROOT}/backend-python/migrate_assessment_tables.py"; then
    warn "受控量表迁移 Python 语法检查失败"
    failures=$((failures + 1))
  fi
else
  warn "缺少 python3，无法验证数据库安全脚本"
  failures=$((failures + 1))
fi

nginx_config="${DEPLOY_ROOT}/nginx/mini-program.conf"
bootstrap_config="${DEPLOY_ROOT}/nginx/mini-program-http-bootstrap.conf"
test_only_nginx_config="${DEPLOY_ROOT}/nginx/mini-program-test-only.conf"
test_only_bootstrap_config="${DEPLOY_ROOT}/nginx/mini-program-test-only-http-bootstrap.conf"
logrotate_config="${DEPLOY_ROOT}/logrotate/mini-program"
rsyslog_config="${DEPLOY_ROOT}/rsyslog/30-mini-program.conf"

info "检查 Nginx 四域、端口、默认拒绝和日志隐私"
for domain in \
  eap.ji-psy.com admin.ji-psy.com \
  test.eap.ji-psy.com test.admin.ji-psy.com; do
  assert_contains "${nginx_config}" "${domain}"
  assert_contains "${bootstrap_config}" "${domain}"
done
for port in 28000 23001 23000 18000 13001 13000; do
  assert_contains "${nginx_config}" "127.0.0.1:${port}"
done
assert_count "${nginx_config}" "listen 80 default_server;" 1
assert_count "${nginx_config}" "listen 443 ssl default_server;" 1
assert_contains "${nginx_config}" 'return 444;'
assert_contains "${nginx_config}" '"uri":"$mini_safe_uri"'
assert_contains "${nginx_config}" '"remote_addr":"$mini_safe_remote_addr"'
assert_contains "${bootstrap_config}" '"uri":"$mini_bootstrap_safe_uri"'
assert_contains "${bootstrap_config}" '"remote_addr":"$mini_bootstrap_safe_remote_addr"'
if grep -Fq '$request_uri' <(
  sed -n '/log_format mini_access/,/;/p' "${nginx_config}"
); then
  warn "mini_access 不得记录带 query 的 \$request_uri"
  failures=$((failures + 1))
fi
if grep -Eq 'ssl_certificate|listen 443' "${bootstrap_config}"; then
  warn "TLS bootstrap 配置不得依赖尚未签发的证书"
  failures=$((failures + 1))
fi

info "检查可与 legacy/生产 vhost 共存的 test-only Nginx 配置"
for config in "${test_only_bootstrap_config}" "${test_only_nginx_config}"; do
  for domain in test.eap.ji-psy.com test.admin.ji-psy.com; do
    assert_contains "${config}" "${domain}"
  done
  assert_code_not_contains "${config}" "default_server"
  assert_code_not_contains "${config}" "server_name _"
  assert_code_not_contains "${config}" "server_name eap.ji-psy.com"
  assert_code_not_contains "${config}" "server_name admin.ji-psy.com"
  assert_code_not_contains "${config}" "127.0.0.1:23000"
  assert_code_not_contains "${config}" "127.0.0.1:23001"
  assert_code_not_contains "${config}" "127.0.0.1:28000"
done
for port in 18000 13001 13000; do
  assert_contains "${test_only_nginx_config}" "127.0.0.1:${port}"
done
assert_contains "${test_only_nginx_config}" '"uri":"$mini_test_only_safe_uri"'
assert_contains "${test_only_nginx_config}" '"remote_addr":"$mini_test_only_safe_remote_addr"'
assert_contains "${test_only_nginx_config}" 'add_header Content-Security-Policy'
assert_contains "${test_only_nginx_config}" 'listen 443 ssl;'
assert_contains "${test_only_bootstrap_config}" '"uri":"$mini_test_only_bootstrap_safe_uri"'
assert_contains "${test_only_bootstrap_config}" '"remote_addr":"$mini_test_only_bootstrap_safe_remote_addr"'
if grep -Fq '$request_uri' <(
  sed -n '/log_format mini_test_only_access/,/;/p' "${test_only_nginx_config}"
); then
  warn "mini_test_only_access 不得记录带 query 的 \$request_uri"
  failures=$((failures + 1))
fi
if grep -Fq '$request_uri' <(
  sed -n '/log_format mini_test_only_bootstrap_access/,/;/p' "${test_only_bootstrap_config}"
); then
  warn "mini_test_only_bootstrap_access 不得记录带 query 的 \$request_uri"
  failures=$((failures + 1))
fi
if grep -Eq 'ssl_certificate|listen 443' "${test_only_bootstrap_config}"; then
  warn "test-only TLS bootstrap 配置不得依赖尚未签发的证书"
  failures=$((failures + 1))
fi

info "检查日志隔离与轮转"
for path in \
  /data/mini_program/logs/test \
  /data/mini_program/logs/production \
  /data/mini_program/logs/system; do
  assert_contains "${logrotate_config}" "${path}"
done
for tag in \
  mini-test-backend mini-test-admin mini-test-eap \
  mini-test-mssql mini-test-db-init mini-test-migrate \
  mini-production-backend mini-production-admin mini-production-eap \
  mini-production-mssql mini-production-db-init mini-production-migrate; do
  assert_contains "${rsyslog_config}" "${tag}"
done
for option in daily dateext compress "rotate 30" "maxage 30"; do
  assert_contains "${logrotate_config}" "${option}"
done

if command -v shellcheck >/dev/null 2>&1; then
  info "运行 shellcheck"
  if ! shellcheck "${SCRIPT_DIR}"/*.sh; then
    failures=$((failures + 1))
  fi
else
  info "未安装 shellcheck，跳过可选检查"
fi

if command -v docker >/dev/null 2>&1; then
  info "检查三套 Compose 渲染与数据库 profile 隔离"
  for environment in local test production; do
    env_file="${DEPLOY_ROOT}/env/${environment}.env.example"
    override_file="${DEPLOY_ROOT}/compose.${environment}.yml"
    compose=(
      docker compose
      --project-name "mini-validate-${environment}"
      --file "${DEPLOY_ROOT}/compose.yml"
      --file "${override_file}"
      --env-file "${env_file}"
    )
    if ! "${compose[@]}" config --quiet; then
      warn "${environment} Compose 渲染失败"
      failures=$((failures + 1))
      continue
    fi
    default_services="$("${compose[@]}" config --services)"
    if grep -Eq '^(db-init|migrate)$' <<<"${default_services}"; then
      warn "${environment} 普通 Compose 服务集不得包含 db-init/migrate"
      failures=$((failures + 1))
    fi
    profiled_services="$(
      "${compose[@]}" --profile database-init config --services
    )"
    for database_service in db-init migrate; do
      if ! grep -Fxq "${database_service}" <<<"${profiled_services}"; then
        warn "${environment} database-init profile 缺少 ${database_service}"
        failures=$((failures + 1))
      fi
    done
  done
else
  info "未安装 Docker CLI，跳过 Compose 静态渲染检查"
fi

info "检查部署辅助脚本 dry-run"
if ! "${SCRIPT_DIR}/verify-dual-local.sh" >/dev/null; then
  warn "双环境本地验证脚本 dry-run 失败"
  failures=$((failures + 1))
fi
for environment in local test production; do
  if ! "${SCRIPT_DIR}/prepare-data-dirs.sh" \
    --env-file "${DEPLOY_ROOT}/env/${environment}.env.example" >/dev/null; then
    warn "${environment} 持久目录准备脚本 dry-run 失败"
    failures=$((failures + 1))
  fi
done

if command -v nginx >/dev/null 2>&1 \
  && command -v openssl >/dev/null 2>&1 \
  && command -v python3 >/dev/null 2>&1; then
  info "隔离验证候选 Nginx 配置"
  if ! "${SCRIPT_DIR}/validate-nginx-candidate.sh" >/dev/null; then
    warn "候选 Nginx 配置检查失败"
    failures=$((failures + 1))
  fi
else
  info "本机缺少 nginx/openssl/python3，跳过候选 Nginx 可选检查"
fi

if command -v rsyslogd >/dev/null 2>&1; then
  info "运行 rsyslog 语法检查"
  if ! rsyslogd -N1 -f "${rsyslog_config}" >/dev/null 2>&1; then
    warn "rsyslog 片段独立语法检查失败；请在目标机完整配置中复核"
    failures=$((failures + 1))
  fi
else
  info "未安装 rsyslogd，跳过可选检查"
fi

if command -v logrotate >/dev/null 2>&1; then
  info "运行 logrotate debug 检查"
  if ! logrotate --debug "${logrotate_config}" >/dev/null 2>&1; then
    warn "logrotate debug 检查失败"
    failures=$((failures + 1))
  fi
else
  info "未安装 logrotate，跳过可选检查"
fi

((failures == 0)) || die "本地配置校验发现 ${failures} 个问题"
info "本地配置校验通过；未访问远程、Docker daemon、网络或数据库"
