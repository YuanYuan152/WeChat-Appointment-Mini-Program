#!/bin/bash

# One-time host bootstrap. Dry-run is the default; --apply is required to
# create the deployment user or write root-owned host policy.
set -Eeuo pipefail
umask 077
readonly safe_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
PATH="${safe_path}"
export PATH
unset BASH_ENV ENV CDPATH GLOBIGNORE
unset PYTHONHOME PYTHONPATH SSL_CERT_FILE SSL_CERT_DIR
unset OPENSSL_CONF OPENSSL_MODULES
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY
unset http_proxy https_proxy all_proxy no_proxy TMPDIR
IFS=$' \t\n'

readonly deploy_user="gha-test-deploy"
readonly gateway_dir="/usr/local/libexec/mini-program-actions"
readonly gateway_path="${gateway_dir}/actions-test-gateway.sh"
readonly policy_dir="/etc/mini-program-actions"
readonly bundle_dir="${policy_dir}/test"
readonly bundle_integrity="${bundle_dir}/bundle.integrity"
readonly actions_ready_marker="${policy_dir}/test-actions-ready"
readonly state_dir="/data/mini_program/deployments/test"
readonly history_dir="${state_dir}/history"
readonly lock_dir="/run/lock/mini-program-actions"
readonly sudoers_path="/etc/sudoers.d/mini-program-actions-test"
readonly policy_version="actions-test-v1"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source_root="$(cd -- "${script_dir}/.." && pwd)"
source_gateway="${script_dir}/actions-test-gateway.sh"
source_compose="${source_root}/actions-test/compose.yml"
source_smoke="${source_root}/actions-test/smoke-test.sh"
source_cleanup="${source_root}/actions-test/cleanup-test-images.sh"
source_restore="${source_root}/actions-test/restore-test-release.sh"
source_oidc="${source_root}/actions-test/verify-github-oidc.py"

apply=false
public_key_file=""
source_env=""

info() {
  printf '[INFO] %s\n' "$*" >&2
}

die() {
  printf '[ERROR] %s\n' "$1" >&2
  exit "${2:-1}"
}

usage() {
  cat <<'EOF'
Usage:
  install-actions-test-host.sh \
    --public-key-file /path/to/id_ed25519.pub \
    --env-file /data/mini_program/config/test.env \
    [--apply]

默认仅输出并校验安装计划。--apply 才会创建专用用户并写入 root-owned
网关、固定 Compose/健康检查、测试配置、authorized_keys 与 sudoers。

脚本不会登录 GHCR、不会启动容器，也不会执行任何数据库操作。
EOF
}

file_mode() {
  if stat -c '%a' "$1" >/dev/null 2>&1; then
    stat -c '%a' "$1"
  else
    stat -f '%Lp' "$1"
  fi
}

read_single_env_value() {
  local env_file="$1"
  local expected_key="$2"

  awk -v expected_key="${expected_key}" '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      return value
    }

    /^[[:space:]]*#/ || /^[[:space:]]*$/ {
      next
    }

    {
      separator = index($0, "=")
      if (separator == 0) {
        next
      }
      key = trim(substr($0, 1, separator - 1))
      if (key != expected_key) {
        next
      }
      matches += 1
      value = trim(substr($0, separator + 1))
      sub(/\r$/, "", value)
    }

    END {
      if (matches != 1) {
        exit 65
      }
      printf "%s", value
    }
  ' "${env_file}"
}

assert_test_env_invariant() {
  local env_file="$1"
  local key="$2"
  local expected="$3"
  local actual=""

  if ! actual="$(read_single_env_value "${env_file}" "${key}")"; then
    die "测试环境固定项必须且只能定义一次：${key}" 65
  fi
  [[ "${actual}" == "${expected}" ]] \
    || die "测试环境固定项不匹配：${key}" 65
}

assert_fixed_bind_directory() {
  local path="$1"
  local canonical=""
  local owner_uid=""
  local mode=""
  local mode_value=0

  [[ -d "${path}" && ! -L "${path}" ]] \
    || die "测试环境固定 bind 目录不存在或不是普通目录" 78
  canonical="$(readlink -f -- "${path}")"
  [[ "${canonical}" == "${path}" ]] \
    || die "测试环境固定 bind 目录包含符号链接" 78
  owner_uid="$(stat -c '%u' "${path}")"
  mode="$(stat -c '%a' "${path}")"
  [[ "${owner_uid}" == "10001" ]] \
    || die "测试环境固定 bind 目录必须由容器 uid 10001 持有" 78
  mode_value=$((8#${mode}))
  (( (mode_value & 0200) != 0 && (mode_value & 0002) == 0 )) \
    || die "测试环境固定 bind 目录必须允许 uid 10001 写入且禁止 other 写入" 78
}

assert_secure_source_env() {
  local path="$1"
  local parent=""
  local parent_mode=""
  local parent_mode_value=0

  [[ "${path}" == /* && "$(readlink -f -- "${path}")" == "${path}" ]] \
    || die "源测试环境配置必须使用无符号链接的绝对路径" 78
  [[ "$(stat -c '%U:%G' "${path}")" == "root:root" ]] \
    || die "源测试环境配置必须由 root:root 持有" 78
  parent="$(dirname -- "${path}")"
  [[ -d "${parent}" && ! -L "${parent}" \
    && "$(readlink -f -- "${parent}")" == "${parent}" ]] \
    || die "源测试环境配置父目录必须是无符号链接的普通目录" 78
  [[ "$(stat -c '%U:%G' "${parent}")" == "root:root" ]] \
    || die "源测试环境配置父目录必须由 root:root 持有" 78
  parent_mode="$(stat -c '%a' "${parent}")"
  parent_mode_value=$((8#${parent_mode}))
  (( (parent_mode_value & 022) == 0 )) \
    || die "源测试环境配置父目录不得允许 group/other 写入" 78
}

while (($#)); do
  case "$1" in
    --public-key-file)
      [[ $# -ge 2 ]] || die "--public-key-file 缺少值" 64
      public_key_file="$2"
      shift 2
      ;;
    --env-file)
      [[ $# -ge 2 ]] || die "--env-file 缺少值" 64
      source_env="$2"
      shift 2
      ;;
    --apply)
      apply=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "未知参数：$1" 64
      ;;
  esac
done

[[ -n "${public_key_file}" && -n "${source_env}" ]] || {
  usage >&2
  exit 64
}
for path in \
  "${public_key_file}" "${source_env}" "${source_gateway}" \
  "${source_compose}" "${source_smoke}" "${source_cleanup}" \
  "${source_restore}" "${source_oidc}"; do
  [[ -f "${path}" && ! -L "${path}" ]] || die "缺少普通文件：${path}" 66
done
[[ "$(awk 'END { print NR + 0 }' "${public_key_file}")" == 1 ]] \
  || die "公钥文件必须且只能包含一行" 65
command -v ssh-keygen >/dev/null 2>&1 \
  || die "服务器缺少命令：ssh-keygen" 69
ssh-keygen -lf "${public_key_file}" -E sha256 2>/dev/null |
  grep -Fq '(ED25519)' \
  || die "部署公钥无法被 OpenSSH 解析为 ED25519" 65
read -r key_type key_body _ <"${public_key_file}"
[[ "${key_type}" == "ssh-ed25519" && "${key_body}" =~ ^[A-Za-z0-9+/]+={0,3}$ ]] \
  || die "部署公钥必须是有效的 ssh-ed25519 公钥" 65

env_mode="$(file_mode "${source_env}")"
[[ "${env_mode}" == "600" || "${env_mode}" == "0600" ]] \
  || die "源测试环境配置权限必须是 0600" 65

# These are non-secret trust-boundary values. Validate each key exactly once
# without sourcing the file or including its current value in diagnostics.
# The installed Compose also pins the values it consumes, so later application
# releases cannot redirect the test stack to production data or domains.
test_env_invariants=(
  "APP_ENV=test"
  "ENABLE_API_DOCS=true"
  "AUTO_MIGRATE_SCHEMA=false"
  "ALLOW_DEV_LOGIN=true"
  "ALLOW_SIMULATED_PAYMENT=true"
  "DB_USER=mini_test_app"
  "DB_NAME=lxxlBuild_test"
  "BASE_URL=https://test.eap.ji-psy.com"
  "ASSESSMENT_FRONTEND_BASE_URL=https://test.eap.ji-psy.com"
  "CORS_ALLOWED_ORIGINS=https://test.eap.ji-psy.com,https://test.admin.ji-psy.com"
  "ADMIN_PUBLIC_API_BASE_URL=https://test.admin.ji-psy.com"
  "EAP_PUBLIC_API_BASE_URL=https://test.eap.ji-psy.com"
  "EAP_PUBLIC_SITE_URL=https://test.eap.ji-psy.com"
  "NEXT_PUBLIC_DATA_SOURCE=mock"
  "WECHAT_MINIPROGRAM_STATE=trial"
  "WECHAT_PAY_NOTIFY_URL=https://test.eap.ji-psy.com/api/payment/wechat/callback"
  "SMS_MOCK=true"
  "DATA_HOST_ROOT=/data/mini_program"
  "UPLOAD_HOST_DIR=/data/mini_program/shared/test/uploads"
  "ASSESSMENT_DATA_HOST_DIR=/data/mini_program/shared/test/assessment-data"
  "ASSESSMENT_ASSET_HOST_DIR=/data/mini_program/shared/test/assessment-assets"
  "MSSQL_BACKUP_HOST_DIR=/data/mini_program/backups/test"
)
for invariant in "${test_env_invariants[@]}"; do
  invariant_key="${invariant%%=*}"
  invariant_value="${invariant#*=}"
  assert_test_env_invariant \
    "${source_env}" "${invariant_key}" "${invariant_value}"
done

cat >&2 <<EOF
[PLAN] 安装 root-owned 固定策略：
  网关：${gateway_path}
  Compose/健康检查/配置：${bundle_dir}
  镜像清理：${bundle_dir}/cleanup-test-images.sh（仅固定测试 GHCR 仓库）
  人工恢复：${bundle_dir}/restore-test-release.sh（仅本地已验证镜像）
  GitHub OIDC：${bundle_dir}/verify-github-oidc.py（固定仓库/dev/workflow）
  策略版本：${policy_version}
  Actions-ready 标记：${actions_ready_marker}
  状态与历史：${state_dir}
  专用 SSH 用户：${deploy_user}（无密码、无 docker/sudo 组）
  forced command：仅允许 deploy-test SHA + 三个 GHCR digest + run/attempt/actor
  数据库：不会创建、迁移、重启或修改
EOF

if [[ "${apply}" == false ]]; then
  info "DRY-RUN 完成；未修改服务器"
  exit 0
fi

[[ "${EUID}" -eq 0 ]] || die "--apply 必须以 root 执行" 77
for command_name in \
  awk chown df dirname docker find flock getent gpasswd grep id install passwd \
  mktemp mv readlink rm sha256sum sort ssh-keygen stat useradd visudo; do
  command -v "${command_name}" >/dev/null 2>&1 \
    || die "服务器缺少命令：${command_name}" 69
done
[[ -x /usr/bin/openssl ]] || die "服务器缺少固定路径 /usr/bin/openssl" 69
[[ -x /usr/bin/python3 ]] || die "服务器缺少固定路径 /usr/bin/python3" 69
/usr/bin/python3 -I -c \
  'import pathlib, sys; compile(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[1], "exec")' \
  "${source_oidc}" \
  || die "GitHub OIDC 校验器 Python 语法无效" 65
/usr/bin/python3 -I -c \
  'import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)' \
  || die "系统 /usr/bin/python3 必须为 3.8 或更高版本" 69
if ! (
  compose_probe_config="$(mktemp -d)"
  trap 'rm -rf -- "${compose_probe_config}"' EXIT HUP INT TERM
  DOCKER_CONFIG="${compose_probe_config}" docker compose version >/dev/null
); then
  die "系统级 Docker Compose v2 不可用（不能仅依赖 /root/.docker 插件）" 69
fi
assert_secure_source_env "${source_env}"
docker network inspect mini-test_app >/dev/null \
  || die "现有测试数据库所在的 mini-test_app 网络不存在；未写入主机配置" 69
for bind_path in \
  /data/mini_program/shared/test/uploads \
  /data/mini_program/shared/test/assessment-data \
  /data/mini_program/shared/test/assessment-assets; do
  assert_fixed_bind_directory "${bind_path}"
done

authorized_tmp="$(mktemp)"
sudoers_tmp="$(mktemp)"
actions_ready_tmp="$(mktemp)"
integrity_tmp="$(mktemp)"
cleanup() {
  rm -f -- \
    "${authorized_tmp}" "${sudoers_tmp}" "${actions_ready_tmp}" \
    "${integrity_tmp}"
}
trap cleanup EXIT
printf '%s %s %s %s\n' \
  'restrict,command="/usr/local/libexec/mini-program-actions/actions-test-gateway.sh"' \
  "${key_type}" "${key_body}" "github-actions-test-deploy" \
  >"${authorized_tmp}"
cat >"${sudoers_tmp}" <<'EOF'
Defaults:gha-test-deploy !requiretty
Defaults:gha-test-deploy env_reset
Defaults:gha-test-deploy secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Defaults:gha-test-deploy env_delete += "BASH_ENV ENV CDPATH GLOBIGNORE COMPOSE_FILE COMPOSE_PATH_SEPARATOR COMPOSE_PROFILES COMPOSE_PROJECT_NAME DOCKER_CERT_PATH DOCKER_CONFIG DOCKER_CONTEXT DOCKER_HOST DOCKER_TLS_VERIFY PYTHONHOME PYTHONPATH SSL_CERT_FILE SSL_CERT_DIR OPENSSL_CONF OPENSSL_MODULES HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY http_proxy https_proxy all_proxy no_proxy TMPDIR"
gha-test-deploy ALL=(root) NOPASSWD: /usr/local/libexec/mini-program-actions/actions-test-gateway.sh --root *
EOF
chmod 0440 "${sudoers_tmp}"
cat >"${actions_ready_tmp}" <<EOF
ENVIRONMENT=test
DEPLOYMENT_MODE=actions-ready
POLICY_VERSION=${policy_version}
FIXED_GATEWAY=${gateway_path}
POLICY=The root-owned Actions host policy is installed but not active. Only the fixed gateway may create ${policy_dir}/test-actions-only after its first end-to-end successful deployment.
EOF
chmod 0644 "${actions_ready_tmp}"
visudo -cf "${sudoers_tmp}" >/dev/null

dummy_digest="sha256:$(printf '0%.0s' {1..64})"
APP_VERSION="$(printf '0%.0s' {1..40})" \
VCS_REF="$(printf '0%.0s' {1..40})" \
IMAGE_TAG="$(printf '0%.0s' {1..40})" \
BACKEND_IMAGE="ghcr.io/yuanyuan152/wechat-appointment-mini-program/backend-test@${dummy_digest}" \
ADMIN_IMAGE="ghcr.io/yuanyuan152/wechat-appointment-mini-program/admin-test@${dummy_digest}" \
EAP_IMAGE="ghcr.io/yuanyuan152/wechat-appointment-mini-program/eap-test@${dummy_digest}" \
  docker compose \
    --project-name mini-test \
    --file "${source_compose}" \
    --env-file "${source_env}" \
    config --quiet

# Installation/upgrades share the exact application deployment lock. A
# partially installed policy therefore cannot race a live deployment; the
# integrity manifest is written last and makes interrupted upgrades fail
# closed on the next attempt.
install -d -o root -g root -m 0750 "${lock_dir}"
[[ "$(stat -c '%U:%G:%a' "${lock_dir}")" == "root:root:750" ]] \
  || die "部署锁目录必须是 root:root 0750" 78
exec 9>"${lock_dir}/test.lock"
flock -n 9 || die "已有测试环境部署、恢复、清理或主机策略安装正在执行" 75

if getent passwd "${deploy_user}" >/dev/null; then
  existing_home="$(getent passwd "${deploy_user}" | cut -d: -f6)"
  existing_shell="$(getent passwd "${deploy_user}" | cut -d: -f7)"
  [[ "${existing_home}" == "/home/${deploy_user}" \
    && "${existing_shell}" == "/bin/sh" ]] \
    || die "现有 ${deploy_user} 用户属性与专用部署账户不一致" 78
else
  useradd \
    --system \
    --create-home \
    --home-dir "/home/${deploy_user}" \
    --user-group \
    --shell /bin/sh \
    --comment "Restricted GitHub Actions test deploy" \
    "${deploy_user}"
fi
passwd --lock "${deploy_user}" >/dev/null

deploy_uid="$(id -u "${deploy_user}")"
deploy_gid="$(id -g "${deploy_user}")"
primary_group="$(id -gn "${deploy_user}")"
[[ "${deploy_uid}" =~ ^[0-9]+$ && "${deploy_uid}" != 0 ]] \
  || die "${deploy_user} 必须使用非 root UID" 78
[[ "${deploy_gid}" =~ ^[0-9]+$ && "${deploy_gid}" != 0 \
  && "${primary_group}" == "${deploy_user}" ]] \
  || die "${deploy_user} 必须使用同名非 root 专用主组" 78
[[ "$(getent group "${deploy_user}" | cut -d: -f3)" == "${deploy_gid}" ]] \
  || die "${deploy_user} 专用主组配置不一致" 78
for group in $(id -Gn "${deploy_user}"); do
  [[ "${group}" == "${primary_group}" ]] && continue
  gpasswd -d "${deploy_user}" "${group}" >/dev/null
done
for forbidden_group in docker sudo wheel; do
  if id -nG "${deploy_user}" | tr ' ' '\n' | grep -Fxq "${forbidden_group}"; then
    die "${deploy_user} 仍属于高权限组 ${forbidden_group}" 78
  fi
done

home_dir="/home/${deploy_user}"
install -d -o root -g root -m 0755 "${home_dir}"
install -d -o root -g root -m 0755 "${home_dir}/.ssh"
chown -R root:root "${home_dir}"
authorized_keys="${home_dir}/.ssh/authorized_keys"
install -o root -g root -m 0644 "${authorized_tmp}" "${authorized_keys}"

install -d -o root -g root -m 0755 "${gateway_dir}"
install -d -o root -g root -m 0755 "${policy_dir}"
install -d -o root -g root -m 0700 "${bundle_dir}"
install -o root -g root -m 0644 "${source_compose}" "${bundle_dir}/compose.yml"
install -o root -g root -m 0755 "${source_smoke}" "${bundle_dir}/smoke-test.sh"
install -o root -g root -m 0755 \
  "${source_cleanup}" "${bundle_dir}/cleanup-test-images.sh"
install -o root -g root -m 0700 \
  "${source_restore}" "${bundle_dir}/restore-test-release.sh"
install -o root -g root -m 0755 \
  "${source_oidc}" "${bundle_dir}/verify-github-oidc.py"
install -o root -g root -m 0600 "${source_env}" "${bundle_dir}/test.env"
install -o root -g root -m 0644 "${actions_ready_tmp}" "${actions_ready_marker}"
install -d -o root -g root -m 0750 "${state_dir}" "${history_dir}"
install -o root -g root -m 0755 "${source_gateway}" "${gateway_path}"

{
  printf 'POLICY_VERSION=%s\n' "${policy_version}"
  printf 'GATEWAY_SHA256=%s\n' \
    "$(sha256sum --binary -- "${gateway_path}" | awk '{ print $1 }')"
  printf 'COMPOSE_SHA256=%s\n' \
    "$(sha256sum --binary -- "${bundle_dir}/compose.yml" | awk '{ print $1 }')"
  printf 'SMOKE_SHA256=%s\n' \
    "$(sha256sum --binary -- "${bundle_dir}/smoke-test.sh" | awk '{ print $1 }')"
  printf 'CLEANUP_SHA256=%s\n' \
    "$(sha256sum --binary -- "${bundle_dir}/cleanup-test-images.sh" | awk '{ print $1 }')"
  printf 'RESTORE_SHA256=%s\n' \
    "$(sha256sum --binary -- "${bundle_dir}/restore-test-release.sh" | awk '{ print $1 }')"
  printf 'OIDC_SHA256=%s\n' \
    "$(sha256sum --binary -- "${bundle_dir}/verify-github-oidc.py" | awk '{ print $1 }')"
} >"${integrity_tmp}"
chmod 0600 "${integrity_tmp}"
install -o root -g root -m 0600 "${integrity_tmp}" "${bundle_integrity}"
[[ "$(stat -c '%U:%G:%a' "${actions_ready_marker}")" == "root:root:644" ]] \
  || die "ACTIONS_READY 标记必须是 root:root 0644" 78
[[ "$(stat -c '%U:%G:%a' "${policy_dir}")" == "root:root:755" ]] \
  || die "Actions 策略父目录必须是 root:root 0755" 78

install -o root -g root -m 0440 "${sudoers_tmp}" "${sudoers_path}"
visudo -cf "${sudoers_path}" >/dev/null

APP_VERSION="$(printf '0%.0s' {1..40})" \
VCS_REF="$(printf '0%.0s' {1..40})" \
IMAGE_TAG="$(printf '0%.0s' {1..40})" \
BACKEND_IMAGE="ghcr.io/yuanyuan152/wechat-appointment-mini-program/backend-test@${dummy_digest}" \
ADMIN_IMAGE="ghcr.io/yuanyuan152/wechat-appointment-mini-program/admin-test@${dummy_digest}" \
EAP_IMAGE="ghcr.io/yuanyuan152/wechat-appointment-mini-program/eap-test@${dummy_digest}" \
  docker compose \
    --project-name mini-test \
    --file "${bundle_dir}/compose.yml" \
    --env-file "${bundle_dir}/test.env" \
    config --quiet

info "主机固定部署入口安装完成"
info "GHCR 使用每次 Actions 通过 stdin 提供的短期令牌；主机不保存长期令牌"
info "尚未部署，也未触碰数据库"
