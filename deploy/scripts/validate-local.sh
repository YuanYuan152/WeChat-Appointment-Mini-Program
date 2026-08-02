#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

failures=0

assert_contains() {
  local file="$1"
  local expected="$2"
  if ! grep -Fq -- "${expected}" "${file}"; then
    warn "${file} 缺少：${expected}"
    failures=$((failures + 1))
  fi
}

assert_code_not_contains() {
  local file="$1"
  local unexpected="$2"
  local code
  code="$(sed 's/#.*$//' "${file}")"
  if grep -Fq -- "${unexpected}" <<<"${code}"; then
    warn "${file} 的有效配置不应包含：${unexpected}"
    failures=$((failures + 1))
  fi
}

assert_code_contains() {
  local file="$1"
  local expected="$2"
  local code
  code="$(sed 's/#.*$//' "${file}")"
  if ! grep -Fq -- "${expected}" <<<"${code}"; then
    warn "${file} 的有效配置缺少：${expected}"
    failures=$((failures + 1))
  fi
}

assert_count() {
  local file="$1"
  local expected="$2"
  local count="$3"
  local actual
  actual="$(grep -Fc -- "${expected}" "${file}" || true)"
  if [[ "${actual}" != "${count}" ]]; then
    warn "${file} 中“${expected}”应出现 ${count} 次，实际 ${actual} 次"
    failures=$((failures + 1))
  fi
}

assert_file_exists() {
  local file="$1"
  if [[ ! -f "${file}" ]]; then
    warn "缺少文件：${file}"
    failures=$((failures + 1))
  fi
}

info "检查 Shell 语法"
while IFS= read -r script; do
  if ! bash -n "${script}"; then
    failures=$((failures + 1))
  fi
done < <(
  find "${SCRIPT_DIR}" "${DEPLOY_ROOT}/actions-test" \
    -maxdepth 1 -type f -name '*.sh' -print | sort
)

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
rsyslog_validator="${SCRIPT_DIR}/validate-rsyslog-config.sh"
actions_workflow="${REPO_ROOT}/.github/workflows/deploy-test.yml"
actions_gateway="${SCRIPT_DIR}/actions-test-gateway.sh"
actions_installer="${SCRIPT_DIR}/install-actions-test-host.sh"
actions_compose="${DEPLOY_ROOT}/actions-test/compose.yml"
actions_smoke="${DEPLOY_ROOT}/actions-test/smoke-test.sh"
actions_cleanup="${DEPLOY_ROOT}/actions-test/cleanup-test-images.sh"
actions_restore="${DEPLOY_ROOT}/actions-test/restore-test-release.sh"
actions_oidc="${DEPLOY_ROOT}/actions-test/verify-github-oidc.py"

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
assert_file_exists "${rsyslog_validator}"
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

info "检查 GitHub Actions 测试发布的权限和数据库隔离门禁"
assert_file_exists "${actions_workflow}"
assert_file_exists "${actions_gateway}"
assert_file_exists "${actions_installer}"
assert_file_exists "${actions_compose}"
assert_file_exists "${actions_smoke}"
assert_file_exists "${actions_cleanup}"
assert_file_exists "${actions_restore}"
assert_file_exists "${actions_oidc}"
if [[ -f "${actions_workflow}" ]]; then
  assert_code_contains "${actions_workflow}" "contents: read"
  assert_code_contains "${actions_workflow}" "packages: write"
  assert_code_contains "${actions_workflow}" "packages: read"
  assert_code_contains "${actions_workflow}" "environment:"
  assert_code_contains "${actions_workflow}" "name: test"
  assert_code_contains "${actions_workflow}" "concurrency:"
  assert_code_contains "${actions_workflow}" \
    '"deploy-test ${DEPLOY_POLICY_VERSION} ${DEPLOY_SHA}'
  assert_code_contains "${actions_workflow}" \
    'printf '\''%s\n%s\n'\'' "${GHCR_TOKEN}" "${oidc_token}"'
  assert_code_contains "${actions_workflow}" "id-token: write"
  assert_code_contains "${actions_workflow}" "docker buildx build"
  assert_code_contains "${actions_workflow}" '--metadata-file "${metadata_file}"'
  assert_code_contains "${actions_workflow}" \
    '."containerimage.digest" | select(type == "string")'
  assert_code_contains "${actions_workflow}" "verify_access_gate"
  assert_code_contains "${actions_workflow}" "302|401|403"
  assert_code_not_contains "${actions_workflow}" 'docker pull "${tag}"'
  assert_code_not_contains "${actions_workflow}" "ssh-keyscan"
fi
if [[ -f "${actions_gateway}" ]]; then
  assert_code_contains "${actions_gateway}" "/etc/mini-program-actions/test"
  assert_code_contains "${actions_gateway}" \
    "ghcr.io/yuanyuan152/wechat-appointment-mini-program/backend-test"
  assert_code_contains "${actions_gateway}" \
    "ghcr.io/yuanyuan152/wechat-appointment-mini-program/admin-test"
  assert_code_contains "${actions_gateway}" \
    "ghcr.io/yuanyuan152/wechat-appointment-mini-program/eap-test"
  assert_code_contains "${actions_gateway}" 'BACKEND_IMAGE='
  assert_code_contains "${actions_gateway}" 'ADMIN_IMAGE='
  assert_code_contains "${actions_gateway}" 'EAP_IMAGE='
  assert_code_contains "${actions_gateway}" "--no-build"
  assert_code_contains "${actions_gateway}" 'IFS= read -r -t 30 ghcr_token'
  assert_code_contains "${actions_gateway}" "verify-github-oidc.py"
  assert_code_contains "${actions_gateway}" "bundle.integrity"
  assert_code_contains "${actions_gateway}" "verify_bundle_integrity"
  assert_code_contains "${actions_gateway}" "actions-test-v1"
  assert_code_contains "${actions_gateway}" \
    'timeout --foreground --signal=TERM --kill-after=5s 35s'
  assert_code_contains "${actions_gateway}" "--current-only"
  assert_code_contains "${actions_gateway}" 'export DOCKER_CONFIG='
  assert_code_contains "${actions_gateway}" "docker login ghcr.io"
  assert_code_contains "${actions_gateway}" "rm -rf --"
  assert_code_contains "${actions_gateway}" "org.opencontainers.image.revision"
  assert_code_contains "${actions_gateway}" "org.opencontainers.image.version"
  assert_code_contains "${actions_gateway}" "org.opencontainers.image.source"
  assert_code_contains "${actions_gateway}" ".RepoDigests"
  assert_code_contains "${actions_gateway}" 'pre_pull_minimum_kib=10485760'
  assert_code_contains "${actions_gateway}" 'post_pull_minimum_kib=5242880'
  assert_code_contains "${actions_gateway}" "docker_available_kib"
  assert_code_contains "${actions_gateway}" "cleanup-test-images.sh"
  assert_code_contains "${actions_gateway}" \
    'actions_ready_marker="${policy_dir}/test-actions-ready"'
  assert_code_contains "${actions_gateway}" \
    'actions_deploying_marker="${policy_dir}/test-actions-deploying"'
  assert_code_contains "${actions_gateway}" \
    'actions_only_marker="${policy_dir}/test-actions-only"'
  assert_count "${actions_gateway}" \
    'install -o root -g root -m 0644 /dev/null "${actions_only_marker}"' 2
  assert_code_contains "${actions_gateway}" \
    'rm -f -- "${actions_deploying_marker}"'
  assert_code_contains "${actions_gateway}" \
    'timeout --foreground --signal=TERM --kill-after=8m 20m'
  assert_count "${actions_gateway}" "verify_running_images" 3
  for forbidden in \
    "git pull" \
    "git checkout" \
    "/releases/" \
    "deploy/scripts/deploy.sh" \
    "--include-database" \
    "--initialize-database" \
    "--migrate" \
    "--provision-runtime-db-user" \
    "--profile database-init"; do
    assert_code_not_contains "${actions_gateway}" "${forbidden}"
  done
fi
if [[ -f "${actions_installer}" ]]; then
  assert_code_contains "${actions_installer}" \
    "/usr/local/libexec/mini-program-actions/actions-test-gateway.sh"
  assert_code_contains "${actions_installer}" \
    'policy_dir="/etc/mini-program-actions"'
  assert_code_contains "${actions_installer}" \
    'bundle_dir="${policy_dir}/test"'
  assert_code_contains "${actions_installer}" \
    'restrict,command="/usr/local/libexec/mini-program-actions/actions-test-gateway.sh"'
  assert_code_contains "${actions_installer}" "NOPASSWD:"
  assert_code_contains "${actions_installer}" "cleanup-test-images.sh"
  assert_code_contains "${actions_installer}" "restore-test-release.sh"
  assert_code_contains "${actions_installer}" "verify-github-oidc.py"
  assert_code_contains "${actions_installer}" "bundle.integrity"
  assert_code_contains "${actions_installer}" "POLICY_VERSION="
  assert_code_contains "${actions_installer}" \
    'flock -n 9 || die "已有测试环境部署'
  assert_code_contains "${actions_installer}" \
    'install -o root -g root -m 0700'
  assert_code_contains "${actions_installer}" \
    'DOCKER_CONFIG="${compose_probe_config}" docker compose version'
  assert_code_contains "${actions_installer}" \
    'actions_ready_marker="${policy_dir}/test-actions-ready"'
  assert_code_contains "${actions_installer}" \
    'install -o root -g root -m 0644 "${actions_ready_tmp}"'
  assert_code_contains "${actions_installer}" \
    'install -d -o root -g root -m 0755 "${policy_dir}"'
  assert_code_not_contains "${actions_installer}" "actions_only_marker="
  assert_code_contains "${actions_installer}" "read_single_env_value"
  assert_code_contains "${actions_installer}" "matches != 1"
  assert_code_contains "${actions_installer}" "assert_secure_source_env"
  assert_code_contains "${actions_installer}" \
    '源测试环境配置必须由 root:root 持有'
  assert_code_contains "${actions_installer}" \
    'env_mode}" == "600"'
  assert_code_contains "${actions_installer}" "assert_fixed_bind_directory"
  assert_code_contains "${actions_installer}" 'readlink -f -- "${path}"'
  assert_code_contains "${actions_installer}" 'owner_uid}" == "10001"'
  for invariant in \
    "APP_ENV=test" \
    "DB_USER=mini_test_app" \
    "DB_NAME=lxxlBuild_test" \
    "BASE_URL=https://test.eap.ji-psy.com" \
    "CORS_ALLOWED_ORIGINS=https://test.eap.ji-psy.com,https://test.admin.ji-psy.com" \
    "EAP_PUBLIC_SITE_URL=https://test.eap.ji-psy.com" \
    "UPLOAD_HOST_DIR=/data/mini_program/shared/test/uploads" \
    "ASSESSMENT_DATA_HOST_DIR=/data/mini_program/shared/test/assessment-data" \
    "ASSESSMENT_ASSET_HOST_DIR=/data/mini_program/shared/test/assessment-assets"; do
    assert_code_contains "${actions_installer}" "\"${invariant}\""
  done
fi
if [[ -f "${actions_oidc}" ]]; then
  assert_contains "${actions_oidc}" \
    'AUDIENCE = "urn:ji-psy:test-deploy:124.221.56.121"'
  assert_contains "${actions_oidc}" \
    'REF = "refs/heads/dev"'
  assert_contains "${actions_oidc}" \
    'SUBJECT = f"repo:{REPOSITORY}:environment:test"'
  assert_contains "${actions_oidc}" \
    'verify_current_dev_sha(arguments.release_sha)'
  assert_contains "${actions_oidc}" \
    'consume_oidc_proof('
  if command -v python3 >/dev/null 2>&1; then
    if ! python3 -c \
      'import pathlib, sys; path = pathlib.Path(sys.argv[1]); compile(path.read_text(encoding="utf-8"), str(path), "exec")' \
      "${actions_oidc}"; then
      warn "GitHub OIDC 校验器 Python 语法失败"
      failures=$((failures + 1))
    fi
  fi
fi
if [[ -f "${actions_smoke}" ]]; then
  assert_code_contains "${actions_smoke}" "admin-local-root"
  assert_code_contains "${actions_smoke}" "eap-local-root"
  assert_code_contains "${actions_smoke}" "302|401|403"
  assert_code_contains "${actions_smoke}" "公网首页未被访问控制保护"
fi
if [[ -f "${actions_cleanup}" ]]; then
  assert_code_contains "${actions_cleanup}" \
    "ghcr.io/yuanyuan152/wechat-appointment-mini-program/backend-test"
  assert_code_contains "${actions_cleanup}" \
    "ghcr.io/yuanyuan152/wechat-appointment-mini-program/admin-test"
  assert_code_contains "${actions_cleanup}" \
    "ghcr.io/yuanyuan152/wechat-appointment-mini-program/eap-test"
  assert_code_contains "${actions_cleanup}" "default_keep_history=8"
  assert_code_contains "${actions_cleanup}" \
    'selected_manifests["${current_manifest}"]=1'
  assert_code_contains "${actions_cleanup}" "direct_previous="
  assert_code_contains "${actions_cleanup}" "docker image rm"
  for forbidden in \
    "docker system prune" \
    "docker image prune" \
    "mini-production" \
    "backend-production" \
    "admin-production" \
    "eap-production" \
    "docker image rm --force" \
    "docker image rm -f"; do
    assert_code_not_contains "${actions_cleanup}" "${forbidden}"
  done
fi
if [[ -f "${actions_restore}" ]]; then
  assert_code_contains "${actions_restore}" \
    'installed_script="${bundle_dir}/restore-test-release.sh"'
  assert_code_contains "${actions_restore}" \
    'lock_file="${lock_dir}/test.lock"'
  assert_code_contains "${actions_restore}" "--current"
  assert_code_contains "${actions_restore}" "--previous"
  assert_code_contains "${actions_restore}" "find_latest_previous_manifest"
  assert_code_contains "${actions_restore}" \
    'MANIFEST_VERSION}" == "${CURRENT_VERSION}'
  assert_code_contains "${actions_restore}" "verify_local_image"
  assert_code_contains "${actions_restore}" "org.opencontainers.image.revision"
  assert_code_contains "${actions_restore}" "org.opencontainers.image.version"
  assert_code_contains "${actions_restore}" "org.opencontainers.image.source"
  assert_code_contains "${actions_restore}" ".RepoDigests"
  assert_code_contains "${actions_restore}" "--no-build"
  assert_code_contains "${actions_restore}" "verify_running_images"
  assert_code_contains "${actions_restore}" "archive_original_current"
  assert_code_contains "${actions_restore}" "atomic_restore_current_manifest"
  assert_code_contains "${actions_restore}" "restore_original_release"
  assert_code_contains "${actions_restore}" \
    'export DOCKER_CONFIG="${docker_config}"'
  for forbidden in \
    "docker login" \
    "docker pull" \
    "docker build" \
    "git pull" \
    "git checkout" \
    "--include-database" \
    "--initialize-database" \
    "--migrate" \
    "--profile database-init"; do
    assert_code_not_contains "${actions_restore}" "${forbidden}"
  done
fi
if [[ -f "${actions_compose}" ]]; then
  assert_code_contains "${actions_compose}" \
    'image: "${BACKEND_IMAGE:?BACKEND_IMAGE is required}"'
  assert_code_contains "${actions_compose}" \
    'image: "${ADMIN_IMAGE:?ADMIN_IMAGE is required}"'
  assert_code_contains "${actions_compose}" \
    'image: "${EAP_IMAGE:?EAP_IMAGE is required}"'
  assert_count "${actions_compose}" \
    'APP_VERSION: "${APP_VERSION:?APP_VERSION is required}"' 3
  assert_count "${actions_compose}" 'user: "10001:10001"' 1
  assert_count "${actions_compose}" 'user: "1000:1000"' 2
  assert_code_not_contains "${actions_compose}" "mssql:"
  assert_code_not_contains "${actions_compose}" "db-init:"
  assert_code_not_contains "${actions_compose}" "migrate:"
  assert_code_contains "${actions_compose}" "DB_NAME: lxxlBuild_test"
  assert_code_contains "${actions_compose}" \
    "BASE_URL: https://test.eap.ji-psy.com"
  assert_code_contains "${actions_compose}" \
    'CORS_ALLOWED_ORIGINS: "https://test.eap.ji-psy.com,https://test.admin.ji-psy.com"'
  assert_code_contains "${actions_compose}" \
    "NEXT_PUBLIC_SITE_URL: https://test.eap.ji-psy.com"
  assert_code_contains "${actions_compose}" 'WECHAT_PAY_MCH_ID: ""'
  assert_code_contains "${actions_compose}" 'WECHAT_PAY_KEY: ""'
  assert_code_not_contains "${actions_compose}" '${SYSLOG_ADDRESS'
  for bind_path in \
    "/data/mini_program/shared/test/uploads:/data/uploads" \
    "/data/mini_program/shared/test/assessment-data:/data/assessment-data" \
    "/data/mini_program/shared/test/assessment-assets:/data/assessment-assets"; do
    assert_code_contains "${actions_compose}" "${bind_path}"
  done
  for untrusted_variable in \
    '${DB_NAME' \
    '${BASE_URL' \
    '${ASSESSMENT_FRONTEND_BASE_URL' \
    '${CORS_ALLOWED_ORIGINS' \
    '${EAP_PUBLIC_API_BASE_URL' \
    '${EAP_PUBLIC_SITE_URL' \
    '${UPLOAD_HOST_DIR' \
    '${ASSESSMENT_DATA_HOST_DIR' \
    '${ASSESSMENT_ASSET_HOST_DIR'; do
    assert_code_not_contains "${actions_compose}" "${untrusted_variable}"
  done
fi
if [[ -f "${actions_workflow}" ]]; then
  for forbidden in \
    "--include-database" \
    "--initialize-database" \
    "--migrate" \
    "--provision-runtime-db-user" \
    "--profile database-init"; do
    assert_code_not_contains "${actions_workflow}" "${forbidden}"
  done
fi

if [[ -f "${actions_installer}" ]]; then
  info "验证 Actions 主机安装器对测试环境固定项 fail-closed"
  installer_fixture_dir="$(mktemp -d /tmp/mini-actions-installer.XXXXXX)"
  installer_private_key="${installer_fixture_dir}/id_ed25519"
  installer_public_key="${installer_private_key}.pub"
  installer_valid_env="${installer_fixture_dir}/test.env"
  if ! ssh-keygen \
      -q -t ed25519 -N '' \
      -C validate-local \
      -f "${installer_private_key}"; then
    warn "无法生成 Actions 安装器测试用 ED25519 公钥"
    failures=$((failures + 1))
  fi
  cp "${DEPLOY_ROOT}/env/test.env.example" "${installer_valid_env}"
  chmod 0600 "${installer_valid_env}"

  if ! "${actions_installer}" \
    --public-key-file "${installer_public_key}" \
    --env-file "${installer_valid_env}" >/dev/null 2>&1; then
    warn "Actions 主机安装器拒绝了合法测试环境示例"
    failures=$((failures + 1))
  fi

  installer_bad_env="${installer_fixture_dir}/bad.env"
  for mutation in \
    'DB_NAME=lxxlBuild_production' \
    'EAP_PUBLIC_SITE_URL=https://eap.ji-psy.com' \
    'UPLOAD_HOST_DIR=/data/mini_program/shared/production/uploads'; do
    mutation_key="${mutation%%=*}"
    mutation_value="${mutation#*=}"
    awk -v key="${mutation_key}" -v value="${mutation_value}" '
      index($0, key "=") == 1 {
        print key "=" value
        next
      }
      { print }
    ' "${installer_valid_env}" >"${installer_bad_env}"
    chmod 0600 "${installer_bad_env}"
    if "${actions_installer}" \
      --public-key-file "${installer_public_key}" \
      --env-file "${installer_bad_env}" >/dev/null 2>&1; then
      warn "Actions 主机安装器未拒绝被篡改的固定项：${mutation_key}"
      failures=$((failures + 1))
    fi
  done

  cp "${installer_valid_env}" "${installer_bad_env}"
  printf '%s\n' 'DB_NAME=lxxlBuild_test' >>"${installer_bad_env}"
  chmod 0600 "${installer_bad_env}"
  if "${actions_installer}" \
    --public-key-file "${installer_public_key}" \
    --env-file "${installer_bad_env}" >/dev/null 2>&1; then
    warn "Actions 主机安装器未拒绝重复定义的固定项"
    failures=$((failures + 1))
  fi
  rm -rf -- "${installer_fixture_dir}"
fi

if command -v shellcheck >/dev/null 2>&1; then
  info "运行 shellcheck（全部部署脚本仅阻断 error）"
  if ! shellcheck --severity=error "${SCRIPT_DIR}"/*.sh; then
    failures=$((failures + 1))
  fi

  info "运行 shellcheck（Actions 测试发布脚本阻断 warning 及以上）"
  if ! shellcheck --severity=warning \
    "${actions_gateway}" \
    "${actions_installer}" \
    "${actions_smoke}" \
    "${actions_cleanup}" \
    "${actions_restore}"; then
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
    default_config="$("${compose[@]}" config)"
    app_version_environment_count="$(
      grep -Ec '^      APP_VERSION:' <<<"${default_config}" || true
    )"
    if [[ "${app_version_environment_count}" != 3 ]]; then
      warn "${environment} Compose 的三个应用必须都注入 runtime APP_VERSION"
      failures=$((failures + 1))
    fi
    default_images="$("${compose[@]}" config --images)"
    app_env_value="$(sed -n 's/^APP_ENV=//p' "${env_file}" | head -n 1)"
    for expected_image in \
      "mini-${app_env_value}-backend:" \
      "mini-${app_env_value}-admin:" \
      "mini-${app_env_value}-eap:"; do
      if ! grep -Fq "${expected_image}" <<<"${default_images}"; then
        warn "${environment} Compose 默认镜像名缺少 ${expected_image}"
        failures=$((failures + 1))
      fi
    done
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
    if [[ "${environment}" == "test" ]]; then
      digest='sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      backend_ref="ghcr.io/yuanyuan152/wechat-appointment-mini-program/backend-test@${digest}"
      admin_ref="ghcr.io/yuanyuan152/wechat-appointment-mini-program/admin-test@${digest}"
      eap_ref="ghcr.io/yuanyuan152/wechat-appointment-mini-program/eap-test@${digest}"
      digest_images="$(
        BACKEND_IMAGE="${backend_ref}" \
        ADMIN_IMAGE="${admin_ref}" \
        EAP_IMAGE="${eap_ref}" \
          "${compose[@]}" config --images
      )"
      for expected_image in "${backend_ref}" "${admin_ref}" "${eap_ref}"; do
        if ! grep -Fxq "${expected_image}" <<<"${digest_images}"; then
          warn "test Compose 未完整保留 digest 镜像引用：${expected_image}"
          failures=$((failures + 1))
        fi
      done
    fi
  done

  info "检查 Actions 固定 Compose 只包含三个应用和 digest 镜像"
  actions_sha="$(printf '0%.0s' {1..40})"
  actions_digest="sha256:$(printf 'a%.0s' {1..64})"
  actions_backend_ref="ghcr.io/yuanyuan152/wechat-appointment-mini-program/backend-test@${actions_digest}"
  actions_admin_ref="ghcr.io/yuanyuan152/wechat-appointment-mini-program/admin-test@${actions_digest}"
  actions_eap_ref="ghcr.io/yuanyuan152/wechat-appointment-mini-program/eap-test@${actions_digest}"
  actions_compose_command=(
    docker compose
    --project-name mini-test
    --file "${actions_compose}"
    --env-file "${DEPLOY_ROOT}/env/test.env.example"
  )
  if ! actions_rendered="$(
    APP_VERSION="${actions_sha}" \
    VCS_REF="${actions_sha}" \
    IMAGE_TAG="${actions_sha}" \
    BACKEND_IMAGE="${actions_backend_ref}" \
    ADMIN_IMAGE="${actions_admin_ref}" \
    EAP_IMAGE="${actions_eap_ref}" \
      "${actions_compose_command[@]}" config
  )"; then
    warn "Actions 固定 Compose 渲染失败"
    failures=$((failures + 1))
  else
    actions_services="$(
      sed -n '/^services:/,/^[^ ]/p' <<<"${actions_rendered}" \
        | sed -n 's/^  \([a-z][a-z0-9-]*\):$/\1/p'
    )"
    if [[ "${actions_services}" != $'admin\nbackend\neap' ]]; then
      warn "Actions 固定 Compose 服务必须且只能是 admin/backend/eap"
      failures=$((failures + 1))
    fi
    for expected_image in \
      "${actions_backend_ref}" "${actions_admin_ref}" "${actions_eap_ref}"; do
      if ! grep -Fq -- "image: ${expected_image}" <<<"${actions_rendered}"; then
        warn "Actions 固定 Compose 缺少 digest 镜像：${expected_image}"
        failures=$((failures + 1))
      fi
    done
  fi
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
  info "运行 rsyslog include 片段语法检查"
  if ! "${rsyslog_validator}" --fragment "${rsyslog_config}"; then
    warn "rsyslog include 片段语法检查失败"
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
