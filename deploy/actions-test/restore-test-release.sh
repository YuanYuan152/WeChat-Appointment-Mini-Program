#!/bin/bash

# Root-only break-glass recovery for the Actions-managed test application
# containers. It deliberately has no registry credentials and never pulls,
# builds, logs in, or touches database services.
set -Eeuo pipefail
umask 077
readonly safe_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
PATH="${safe_path}"
export PATH
unset BASH_ENV ENV CDPATH GLOBIGNORE
unset COMPOSE_FILE COMPOSE_PATH_SEPARATOR COMPOSE_PROFILES COMPOSE_PROJECT_NAME
unset DOCKER_CERT_PATH DOCKER_CONFIG DOCKER_CONTEXT DOCKER_HOST DOCKER_TLS_VERIFY
IFS=$' \t\n'

readonly backend_repository="ghcr.io/yuanyuan152/wechat-appointment-mini-program/backend-test"
readonly admin_repository="ghcr.io/yuanyuan152/wechat-appointment-mini-program/admin-test"
readonly eap_repository="ghcr.io/yuanyuan152/wechat-appointment-mini-program/eap-test"
readonly expected_source="https://github.com/YuanYuan152/WeChat-Appointment-Mini-Program"
readonly policy_version="actions-test-v1"
readonly bundle_dir="/etc/mini-program-actions/test"
readonly installed_script="${bundle_dir}/restore-test-release.sh"
readonly compose_file="${bundle_dir}/compose.yml"
readonly environment_file="${bundle_dir}/test.env"
readonly smoke_script="${bundle_dir}/smoke-test.sh"
readonly state_dir="/data/mini_program/deployments/test"
readonly history_dir="${state_dir}/history"
readonly current_manifest="${state_dir}/current.env"
readonly lock_dir="/run/lock/mini-program-actions"
readonly lock_file="${lock_dir}/test.lock"
readonly project_name="mini-test"

info() {
  printf '[INFO] %s\n' "$*" >&2
}

warn() {
  printf '[WARN] %s\n' "$*" >&2
}

die() {
  printf '[ERROR] %s\n' "$1" >&2
  exit "${2:-1}"
}

usage() {
  cat <<'EOF'
Usage:
  sudo /etc/mini-program-actions/test/restore-test-release.sh --current
  sudo /etc/mini-program-actions/test/restore-test-release.sh --previous

--current  使用 current manifest 和本地已有镜像重建三个测试应用容器。
--previous 使用最新一份 previous-*.env 和本地已有镜像恢复三个测试应用容器。

脚本不登录镜像仓库、不拉取或构建镜像、不启动或修改数据库。
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "服务器缺少命令：$1" 69
}

file_mode() {
  stat -c '%a' "$1"
}

assert_root_owned_file() {
  local path="$1"
  local label="$2"
  local mode

  [[ -f "${path}" && ! -L "${path}" ]] || die "${label} 必须是普通文件" 78
  [[ "$(stat -c '%U:%G' "${path}")" == "root:root" ]] \
    || die "${label} 必须由 root:root 持有" 78
  mode="$(file_mode "${path}")"
  (( (8#${mode} & 022) == 0 )) || die "${label} 不得允许 group/other 写入" 78
}

assert_secure_directory() {
  local path="$1"
  local label="$2"
  local mode

  [[ -d "${path}" && ! -L "${path}" ]] || die "${label} 必须是目录" 78
  [[ "$(stat -c '%U:%G' "${path}")" == "root:root" ]] \
    || die "${label} 必须由 root:root 持有" 78
  mode="$(file_mode "${path}")"
  (( (8#${mode} & 022) == 0 )) || die "${label} 不得允许 group/other 写入" 78
}

validate_image_for_service() {
  local service="$1"
  local image="$2"
  local repository=""
  local digest=""
  local legacy_tag=""

  case "${service}" in
    backend) repository="${backend_repository}" ;;
    admin) repository="${admin_repository}" ;;
    eap) repository="${eap_repository}" ;;
    *) return 1 ;;
  esac

  if [[ "${image}" == "${repository}@"* ]]; then
    digest="${image#"${repository}@"}"
    [[ "${digest}" =~ ^sha256:[0-9a-f]{64}$ ]]
    return
  fi
  if [[ "${image}" == "mini-test-${service}:"* ]]; then
    legacy_tag="${image#"mini-test-${service}:"}"
    [[ "${legacy_tag}" =~ ^[0-9a-f]{40}$ ]]
    return
  fi
  return 1
}

load_manifest() {
  local path="$1"
  local line key value
  local environment="" manifest_policy_version="" version=""
  local backend_image="" admin_image="" eap_image=""
  local run_id="" run_attempt="" deployed_at="" database_changed=""
  local seen_environment=0 seen_policy_version=0 seen_version=0
  local seen_backend=0 seen_admin=0 seen_eap=0
  local seen_run_id=0 seen_run_attempt=0 seen_deployed_at=0
  local seen_database_changed=0

  assert_root_owned_file "${path}" "部署清单"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" == *=* ]] || die "部署清单格式无效：${path}" 78
    key="${line%%=*}"
    value="${line#*=}"
    case "${key}" in
      ENVIRONMENT)
        ((seen_environment += 1))
        environment="${value}"
        ;;
      POLICY_VERSION)
        ((seen_policy_version += 1))
        manifest_policy_version="${value}"
        ;;
      VERSION)
        ((seen_version += 1))
        version="${value}"
        ;;
      BACKEND_IMAGE)
        ((seen_backend += 1))
        backend_image="${value}"
        ;;
      ADMIN_IMAGE)
        ((seen_admin += 1))
        admin_image="${value}"
        ;;
      EAP_IMAGE)
        ((seen_eap += 1))
        eap_image="${value}"
        ;;
      GITHUB_RUN_ID)
        ((seen_run_id += 1))
        run_id="${value}"
        ;;
      GITHUB_RUN_ATTEMPT)
        ((seen_run_attempt += 1))
        run_attempt="${value}"
        ;;
      DEPLOYED_AT)
        ((seen_deployed_at += 1))
        deployed_at="${value}"
        ;;
      DATABASE_CHANGED)
        ((seen_database_changed += 1))
        database_changed="${value}"
        ;;
      *)
        die "部署清单包含未知字段：${key}" 78
        ;;
    esac
  done <"${path}"

  [[ "${seen_environment}" == 1 && "${environment}" == test ]] \
    || die "部署清单环境无效：${path}" 78
  [[ "${seen_policy_version}" == 1 \
    && "${manifest_policy_version}" == "${policy_version}" ]] \
    || die "部署清单策略版本无效：${path}" 78
  [[ "${seen_version}" == 1 && "${version}" =~ ^[0-9a-f]{40}$ ]] \
    || die "部署清单版本无效：${path}" 78
  if [[ "${seen_backend}" != 1 ]] \
    || ! validate_image_for_service backend "${backend_image}"; then
    die "部署清单 backend 镜像无效：${path}" 78
  fi
  if [[ "${seen_admin}" != 1 ]] \
    || ! validate_image_for_service admin "${admin_image}"; then
    die "部署清单 admin 镜像无效：${path}" 78
  fi
  if [[ "${seen_eap}" != 1 ]] \
    || ! validate_image_for_service eap "${eap_image}"; then
    die "部署清单 eap 镜像无效：${path}" 78
  fi
  [[ "${seen_run_id}" == 1 && "${run_id}" =~ ^(0|[1-9][0-9]{0,19})$ ]] \
    || die "部署清单 GITHUB_RUN_ID 无效：${path}" 78
  [[ "${seen_run_attempt}" == 1 \
    && "${run_attempt}" =~ ^(0|[1-9][0-9]{0,5})$ ]] \
    || die "部署清单 GITHUB_RUN_ATTEMPT 无效：${path}" 78
  [[ "${seen_deployed_at}" == 1 \
    && "${deployed_at}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] \
    || die "部署清单 DEPLOYED_AT 无效：${path}" 78
  [[ "${seen_database_changed}" == 1 && "${database_changed}" == false ]] \
    || die "部署清单必须明确 DATABASE_CHANGED=false：${path}" 78

  MANIFEST_VERSION="${version}"
  MANIFEST_BACKEND_IMAGE="${backend_image}"
  MANIFEST_ADMIN_IMAGE="${admin_image}"
  MANIFEST_EAP_IMAGE="${eap_image}"
}

verify_local_image() {
  local service="$1"
  local image="$2"
  local expected_version="$3"
  local revision version source

  validate_image_for_service "${service}" "${image}" \
    || die "${service} 镜像引用不在恢复白名单内" 78
  docker image inspect "${image}" >/dev/null 2>&1 \
    || die "${service} 恢复镜像本地不存在：${image}" 66
  revision="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.revision" }}' \
      "${image}"
  )"
  version="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.version" }}' \
      "${image}"
  )"
  source="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.source" }}' \
      "${image}"
  )"
  [[ "${revision}" == "${expected_version}" && "${version}" == "${expected_version}" ]] \
    || die "${service} 镜像 OCI revision/version 与 manifest 不一致" 78

  if [[ "${image}" == ghcr.io/*@sha256:* ]]; then
    [[ "${source}" == "${expected_source}" ]] \
      || die "${service} GHCR 镜像 OCI source 不属于固定代码仓库" 78
    docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' \
      "${image}" | grep -Fx -- "${image}" >/dev/null \
      || die "${service} 本地镜像 RepoDigest 与 manifest 不一致" 78
  else
    [[ -z "${source}" || "${source}" == "${expected_source}" ]] \
      || die "${service} legacy 镜像 OCI source 无效" 78
  fi
}

compose_up() {
  local version="$1"
  local backend_image="$2"
  local admin_image="$3"
  local eap_image="$4"

  APP_VERSION="${version}" \
  VCS_REF="${version}" \
  IMAGE_TAG="${version}" \
  BACKEND_IMAGE="${backend_image}" \
  ADMIN_IMAGE="${admin_image}" \
  EAP_IMAGE="${eap_image}" \
    docker compose \
      --project-name "${project_name}" \
      --file "${compose_file}" \
      --env-file "${environment_file}" \
      up -d --no-deps --no-build --wait --wait-timeout 180 \
      backend admin eap
}

running_image_for_service() {
  local service="$1"
  local container_ids container_id count health_status
  local configured_user container_image expected_user

  container_ids="$(
    docker ps \
      --filter "label=com.docker.compose.project=${project_name}" \
      --filter "label=com.docker.compose.service=${service}" \
      --format '{{.ID}}'
  )"
  count="$(awk 'NF { count++ } END { print count + 0 }' <<<"${container_ids}")"
  [[ "${count}" == 1 ]] || return 1
  container_id="$(awk 'NF { print; exit }' <<<"${container_ids}")"
  health_status="$(
    docker inspect --format \
      '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
      "${container_id}"
  )"
  [[ "${health_status}" == "healthy" ]] || return 1
  container_image="$(docker inspect --format '{{.Config.Image}}' "${container_id}")"
  configured_user="$(docker inspect --format '{{.Config.User}}' "${container_id}")"
  case "${service}" in
    backend) expected_user="10001:10001" ;;
    admin|eap) expected_user="1000:1000" ;;
    *) return 1 ;;
  esac
  if [[ "${configured_user}" != "${expected_user}" ]]; then
    case "${service}:${configured_user}:${container_image}" in
      backend:app:mini-test-backend:[0-9a-f]*)
        [[ "${container_image#mini-test-backend:}" =~ ^[0-9a-f]{40}$ ]] \
          || return 1
        ;;
      admin:node:mini-test-admin:[0-9a-f]*)
        [[ "${container_image#mini-test-admin:}" =~ ^[0-9a-f]{40}$ ]] \
          || return 1
        ;;
      eap:node:mini-test-eap:[0-9a-f]*)
        [[ "${container_image#mini-test-eap:}" =~ ^[0-9a-f]{40}$ ]] \
          || return 1
        ;;
      *)
        return 1
        ;;
    esac
  fi
  printf '%s\n' "${container_image}"
}

verify_running_images() {
  local expected_backend="$1"
  local expected_admin="$2"
  local expected_eap="$3"
  local actual_backend actual_admin actual_eap

  actual_backend="$(running_image_for_service backend)" || return 1
  actual_admin="$(running_image_for_service admin)" || return 1
  actual_eap="$(running_image_for_service eap)" || return 1
  [[ "${actual_backend}" == "${expected_backend}" \
    && "${actual_admin}" == "${expected_admin}" \
    && "${actual_eap}" == "${expected_eap}" ]]
}

smoke_release() {
  local version="$1"
  local backend_image="$2"
  local admin_image="$3"
  local eap_image="$4"
  local smoke_arguments=("${version}")

  if [[ "${backend_image}" == mini-test-backend:* \
    || "${admin_image}" == mini-test-admin:* \
    || "${eap_image}" == mini-test-eap:* ]]; then
    smoke_arguments=(--allow-missing-version "${version}")
  fi
  "${smoke_script}" "${smoke_arguments[@]}"
}

find_latest_previous_manifest() {
  local candidate basename modified
  local selected="" selected_modified=-1

  while IFS= read -r -d '' candidate; do
    basename="${candidate##*/}"
    [[ "${basename}" =~ ^previous-[A-Za-z0-9._-]+\.env$ ]] \
      || die "历史目录包含命名无效的 previous manifest：${basename}" 78
    assert_root_owned_file "${candidate}" "previous 部署清单"
    load_manifest "${candidate}"
    # The gateway writes a baseline before every attempt. If that attempt
    # fails, its newest baseline is byte-for-byte the still-current release,
    # so it is not a usable "previous" target.
    if [[ "${MANIFEST_VERSION}" == "${CURRENT_VERSION}" \
      && "${MANIFEST_BACKEND_IMAGE}" == "${CURRENT_BACKEND_IMAGE}" \
      && "${MANIFEST_ADMIN_IMAGE}" == "${CURRENT_ADMIN_IMAGE}" \
      && "${MANIFEST_EAP_IMAGE}" == "${CURRENT_EAP_IMAGE}" ]]; then
      continue
    fi
    modified="$(stat -c '%Y' "${candidate}")"
    [[ "${modified}" =~ ^[0-9]+$ ]] || die "无法读取历史清单时间" 78
    if ((modified > selected_modified)) \
      || { ((modified == selected_modified)) && [[ "${candidate}" > "${selected}" ]]; }; then
      selected="${candidate}"
      selected_modified="${modified}"
    fi
  done < <(find "${history_dir}" -maxdepth 1 -name 'previous-*.env' -print0)

  [[ -n "${selected}" ]] \
    || die "没有与 current 不同且可恢复的 previous-*.env" 66
  printf '%s\n' "${selected}"
}

atomic_restore_current_manifest() {
  local source_manifest="$1"
  local temporary

  temporary="$(mktemp "${state_dir}/.current.XXXXXX")" || return 1
  if ! install -o root -g root -m 0640 "${source_manifest}" "${temporary}" \
    || ! mv -f -- "${temporary}" "${current_manifest}"; then
    rm -f -- "${temporary}"
    return 1
  fi
}

archive_original_current() {
  local source_manifest="$1"
  local version="$2"
  local timestamp archive

  timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  archive="$(
    mktemp --suffix=.env \
      "${history_dir}/previous-${version}-before-manual-restore-${timestamp}.XXXXXX"
  )" || return 1
  if ! install -o root -g root -m 0640 "${source_manifest}" "${archive}"; then
    rm -f -- "${archive}"
    return 1
  fi
  printf '%s\n' "${archive}"
}

restore_original_release() {
  trap - HUP INT TERM
  set +e
  warn "恢复操作失败；尝试恢复原 current 版本 ${CURRENT_VERSION}"
  if ! compose_up \
      "${CURRENT_VERSION}" \
      "${CURRENT_BACKEND_IMAGE}" \
      "${CURRENT_ADMIN_IMAGE}" \
      "${CURRENT_EAP_IMAGE}"; then
    warn "原 current 容器恢复失败"
    return 1
  fi
  if ! verify_running_images \
      "${CURRENT_BACKEND_IMAGE}" \
      "${CURRENT_ADMIN_IMAGE}" \
      "${CURRENT_EAP_IMAGE}"; then
    warn "原 current 容器镜像精确核验失败"
    return 1
  fi
  if ! smoke_release \
      "${CURRENT_VERSION}" \
      "${CURRENT_BACKEND_IMAGE}" \
      "${CURRENT_ADMIN_IMAGE}" \
      "${CURRENT_EAP_IMAGE}"; then
    warn "原 current 健康检查失败"
    return 1
  fi
  atomic_restore_current_manifest "${original_manifest_snapshot}" || {
    warn "应用已恢复，但 current manifest 恢复失败"
    return 1
  }
  return 0
}

handle_signal() {
  local signal_name="$1"
  local exit_code="$2"

  if [[ "${deployment_started}" == true ]]; then
    restore_original_release \
      || warn "${signal_name} 后恢复原 current 失败，需要立即人工介入"
  fi
  exit "${exit_code}"
}

[[ "${EUID}" -eq 0 ]] || die "恢复脚本只能由 root 执行" 77
[[ $# -eq 1 ]] || {
  usage >&2
  exit 64
}
case "$1" in
  --current) restore_mode=current ;;
  --previous) restore_mode=previous ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    die "仅接受 --current 或 --previous" 64
    ;;
esac

for command_name in awk chmod cmp curl date docker find flock grep install mktemp mv readlink rm stat; do
  require_command "${command_name}"
done
[[ "$(readlink -f -- "$0")" == "${installed_script}" ]] \
  || die "必须执行已安装的 root-owned 固定恢复脚本" 77
assert_root_owned_file "${installed_script}" "固定恢复脚本"
assert_secure_directory "${bundle_dir}" "固定部署目录"
assert_root_owned_file "${compose_file}" "固定 Compose 文件"
assert_root_owned_file "${environment_file}" "测试环境配置"
assert_root_owned_file "${smoke_script}" "固定健康检查脚本"
(( (8#$(file_mode "${environment_file}") & 077) == 0 )) \
  || die "测试环境配置必须为 root 私有" 78
[[ -x "${smoke_script}" ]] || die "固定健康检查脚本不可执行" 78
assert_secure_directory "${state_dir}" "部署状态目录"
assert_secure_directory "${history_dir}" "部署历史目录"
assert_secure_directory "${lock_dir}" "部署锁目录"

docker_config="$(mktemp -d /run/mini-program-manual-restore.XXXXXX)"
chmod 0700 "${docker_config}"
original_manifest_snapshot=""
cleanup() {
  rm -rf -- "${docker_config}"
  [[ -z "${original_manifest_snapshot}" ]] \
    || rm -f -- "${original_manifest_snapshot}"
}
trap cleanup EXIT
export DOCKER_CONFIG="${docker_config}"
docker compose version >/dev/null \
  || die "系统级 Docker Compose v2 不可用" 69

exec 9>"${lock_file}"
flock -n 9 || die "已有测试环境部署或恢复正在执行" 75

load_manifest "${current_manifest}"
CURRENT_VERSION="${MANIFEST_VERSION}"
CURRENT_BACKEND_IMAGE="${MANIFEST_BACKEND_IMAGE}"
CURRENT_ADMIN_IMAGE="${MANIFEST_ADMIN_IMAGE}"
CURRENT_EAP_IMAGE="${MANIFEST_EAP_IMAGE}"

if [[ "${restore_mode}" == current ]]; then
  target_manifest="${current_manifest}"
else
  target_manifest="$(find_latest_previous_manifest)"
fi
load_manifest "${target_manifest}"
TARGET_VERSION="${MANIFEST_VERSION}"
TARGET_BACKEND_IMAGE="${MANIFEST_BACKEND_IMAGE}"
TARGET_ADMIN_IMAGE="${MANIFEST_ADMIN_IMAGE}"
TARGET_EAP_IMAGE="${MANIFEST_EAP_IMAGE}"

for service_and_image in \
  "backend|${CURRENT_BACKEND_IMAGE}" \
  "admin|${CURRENT_ADMIN_IMAGE}" \
  "eap|${CURRENT_EAP_IMAGE}"; do
  verify_local_image \
    "${service_and_image%%|*}" "${service_and_image#*|}" "${CURRENT_VERSION}"
done
for service_and_image in \
  "backend|${TARGET_BACKEND_IMAGE}" \
  "admin|${TARGET_ADMIN_IMAGE}" \
  "eap|${TARGET_EAP_IMAGE}"; do
  verify_local_image \
    "${service_and_image%%|*}" "${service_and_image#*|}" "${TARGET_VERSION}"
done

original_manifest_snapshot="$(mktemp "${state_dir}/.manual-original.XXXXXX")"
install -o root -g root -m 0640 \
  "${current_manifest}" "${original_manifest_snapshot}"
deployment_started=false
trap 'handle_signal HUP 129' HUP
trap 'handle_signal INT 130' INT
trap 'handle_signal TERM 143' TERM

info "使用本地镜像恢复测试应用：${TARGET_VERSION}（${restore_mode}）"
deployment_started=true
if ! compose_up \
    "${TARGET_VERSION}" \
    "${TARGET_BACKEND_IMAGE}" \
    "${TARGET_ADMIN_IMAGE}" \
    "${TARGET_EAP_IMAGE}"; then
  restore_original_release \
    || die "目标容器更新失败，且原 current 恢复失败，需要立即人工介入" 70
  die "目标容器更新失败，已恢复原 current" 70
fi
if ! verify_running_images \
    "${TARGET_BACKEND_IMAGE}" \
    "${TARGET_ADMIN_IMAGE}" \
    "${TARGET_EAP_IMAGE}"; then
  restore_original_release \
    || die "目标镜像核验失败，且原 current 恢复失败，需要立即人工介入" 70
  die "目标镜像核验失败，已恢复原 current" 70
fi
if ! smoke_release \
    "${TARGET_VERSION}" \
    "${TARGET_BACKEND_IMAGE}" \
    "${TARGET_ADMIN_IMAGE}" \
    "${TARGET_EAP_IMAGE}"; then
  restore_original_release \
    || die "目标健康检查失败，且原 current 恢复失败，需要立即人工介入" 70
  die "目标健康检查失败，已恢复原 current" 70
fi

if ! archived_manifest="$(archive_original_current \
    "${original_manifest_snapshot}" "${CURRENT_VERSION}")"; then
  restore_original_release \
    || die "原 current 归档失败，且原 current 恢复失败，需要立即人工介入" 70
  die "原 current 归档失败，已恢复原 current" 70
fi
if ! atomic_restore_current_manifest "${target_manifest}"; then
  restore_original_release \
    || die "current manifest 更新失败，且原 current 恢复失败，需要立即人工介入" 70
  die "current manifest 更新失败，已恢复原 current" 70
fi
if [[ ! -f "${current_manifest}" || -L "${current_manifest}" ]] \
  || [[ "$(stat -c '%U:%G:%a' "${current_manifest}")" != "root:root:640" ]] \
  || ! cmp -s -- "${target_manifest}" "${current_manifest}"; then
  restore_original_release \
    || die "current manifest 核验失败，且原 current 恢复失败，需要立即人工介入" 70
  die "current manifest 核验失败，已恢复原 current" 70
fi

deployment_started=false
trap - HUP INT TERM
info "测试应用恢复完成：${TARGET_VERSION}"
info "原 current 已保存为：${archived_manifest}"
info "数据库容器、network、volume 和数据目录均未加入恢复命令"
