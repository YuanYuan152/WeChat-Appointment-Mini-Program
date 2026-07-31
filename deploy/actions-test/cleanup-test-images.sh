#!/bin/bash

# Conservative cleanup for the three GitHub Actions test image repositories.
# It never invokes Docker's global prune commands and never removes a local or
# production image reference.
set -Eeuo pipefail
umask 077
readonly safe_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
PATH="${safe_path}"
export PATH
unset BASH_ENV ENV CDPATH GLOBIGNORE
unset COMPOSE_FILE COMPOSE_PATH_SEPARATOR COMPOSE_PROFILES COMPOSE_PROJECT_NAME
unset DOCKER_CERT_PATH DOCKER_CONTEXT DOCKER_HOST DOCKER_TLS_VERIFY
IFS=$' \t\n'

readonly backend_repository="ghcr.io/yuanyuan152/wechat-appointment-mini-program/backend-test"
readonly admin_repository="ghcr.io/yuanyuan152/wechat-appointment-mini-program/admin-test"
readonly eap_repository="ghcr.io/yuanyuan152/wechat-appointment-mini-program/eap-test"
readonly expected_source="https://github.com/YuanYuan152/WeChat-Appointment-Mini-Program"
readonly policy_version="actions-test-v1"
readonly state_dir="/data/mini_program/deployments/test"
readonly history_dir="${state_dir}/history"
readonly current_manifest="${state_dir}/current.env"
readonly lock_dir="/run/lock/mini-program-actions"
readonly lock_file="${lock_dir}/test.lock"
readonly default_keep_history=8

apply=false
lock_held=false
keep_history="${default_keep_history}"
declare -a extra_protected_images=()
declare -A protected_images=()
declare -A selected_manifests=()
declare -A candidate_images=()

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

file_mode() {
  stat -c '%a' "$1"
}

assert_root_owned_file() {
  local path="$1"
  local label="$2"
  local mode

  [[ -f "${path}" && ! -L "${path}" ]] || die "${label} 必须是普通文件" 78
  [[ "$(stat -c '%U:%G' "${path}")" == root:root ]] \
    || die "${label} 必须由 root:root 持有" 78
  mode="$(file_mode "${path}")"
  (( (8#${mode} & 022) == 0 )) || die "${label} 不得允许 group/other 写入" 78
}

assert_secure_directory() {
  local path="$1"
  local label="$2"
  local mode

  [[ -d "${path}" && ! -L "${path}" ]] || die "${label} 必须是目录" 78
  [[ "$(stat -c '%U:%G' "${path}")" == root:root ]] \
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

protect_manifest_images() {
  local manifest="$1"
  local line key value
  local backend_image=""
  local admin_image=""
  local eap_image=""
  local manifest_policy_version=""
  local seen_policy_version=0
  local seen_backend=0
  local seen_admin=0
  local seen_eap=0

  assert_root_owned_file "${manifest}" "保留清单"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" == *=* ]] || die "保留清单格式无效：${manifest}" 78
    key="${line%%=*}"
    value="${line#*=}"
    case "${key}" in
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
      POLICY_VERSION)
        ((seen_policy_version += 1))
        manifest_policy_version="${value}"
        ;;
      ENVIRONMENT|VERSION|GITHUB_RUN_ID|GITHUB_RUN_ATTEMPT|DEPLOYED_AT|DATABASE_CHANGED)
        ;;
      *)
        die "保留清单包含未知字段：${key}" 78
        ;;
    esac
  done <"${manifest}"

  [[ "${seen_policy_version}" == 1 \
    && "${manifest_policy_version}" == "${policy_version}" ]] \
    || die "保留清单策略版本无效：${manifest}" 78
  if [[ "${seen_backend}" != 1 ]] \
    || ! validate_image_for_service backend "${backend_image}"; then
    die "保留清单 backend 镜像无效：${manifest}" 78
  fi
  if [[ "${seen_admin}" != 1 ]] \
    || ! validate_image_for_service admin "${admin_image}"; then
    die "保留清单 admin 镜像无效：${manifest}" 78
  fi
  if [[ "${seen_eap}" != 1 ]] \
    || ! validate_image_for_service eap "${eap_image}"; then
    die "保留清单 eap 镜像无效：${manifest}" 78
  fi

  protected_images["${backend_image}"]=1
  protected_images["${admin_image}"]=1
  protected_images["${eap_image}"]=1
}

usage() {
  cat <<'EOF'
Usage:
  cleanup-test-images.sh [--keep-history COUNT] [--apply]

Root-owned gateway internal use:
  cleanup-test-images.sh --lock-held --apply \
    [--protect-image REPOSITORY@sha256:DIGEST ...]

Default is a dry-run. Cleanup only considers digest references in the fixed
backend-test, admin-test and eap-test GHCR repositories. Current, direct
previous and the newest history manifests are protected.
EOF
}

while (($#)); do
  case "$1" in
    --apply)
      apply=true
      shift
      ;;
    --lock-held)
      lock_held=true
      shift
      ;;
    --keep-history)
      [[ $# -ge 2 ]] || die "--keep-history 缺少值" 64
      keep_history="$2"
      shift 2
      ;;
    --protect-image)
      [[ $# -ge 2 ]] || die "--protect-image 缺少值" 64
      extra_protected_images+=("$2")
      shift 2
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

[[ "${EUID}" -eq 0 ]] || die "测试镜像清理必须以 root 执行" 77
[[ "${keep_history}" =~ ^([1-9]|1[0-6])$ ]] \
  || die "--keep-history 只能是 1 到 16" 64
if [[ "${lock_held}" == false && "${#extra_protected_images[@]}" -ne 0 ]]; then
  die "--protect-image 只允许固定 gateway 在持锁状态下使用" 64
fi
if [[ "${lock_held}" == true && "${apply}" == false ]]; then
  die "--lock-held 仅允许 gateway 的实际清理流程使用" 64
fi
(( ${#extra_protected_images[@]} <= 3 )) \
  || die "额外保护镜像最多三个" 64

for command_name in awk docker find flock grep install sort stat; do
  command -v "${command_name}" >/dev/null 2>&1 \
    || die "服务器缺少命令：${command_name}" 69
done

assert_secure_directory "${state_dir}" "部署状态目录"
assert_secure_directory "${history_dir}" "部署历史目录"
assert_root_owned_file "${current_manifest}" "current manifest"

if [[ "${lock_held}" == false ]]; then
  if [[ ! -e "${lock_dir}" ]]; then
    install -d -o root -g root -m 0750 "${lock_dir}"
  fi
  assert_secure_directory "${lock_dir}" "部署锁目录"
  exec 9>"${lock_file}"
  flock -n 9 || die "已有测试环境部署或清理正在执行" 75
fi

selected_manifests["${current_manifest}"]=1
history_records="$(
  find "${history_dir}" -maxdepth 1 -type f -name '*.env' \
    -printf '%T@\t%p\n'
)" || die "无法枚举部署历史清单，拒绝清理" 69
recent_manifests="$(
  printf '%s\n' "${history_records}" \
    | sort -t $'\t' -k1,1nr \
    | awk -F $'\t' -v limit="${keep_history}" 'NR <= limit { print $2 }'
)" || die "无法选择最近部署历史清单，拒绝清理" 69
while IFS= read -r manifest; do
  [[ -z "${manifest}" ]] || selected_manifests["${manifest}"]=1
done <<<"${recent_manifests}"
direct_previous="$(
  printf '%s\n' "${history_records}" \
    | awk -F $'\t' '$2 ~ /\/previous-[^\/]*\.env$/ { print }' \
    | sort -t $'\t' -k1,1nr \
    | awk -F $'\t' 'NR == 1 { print $2 }'
)" || die "无法选择直接上一版本清单，拒绝清理" 69
[[ -z "${direct_previous}" ]] || selected_manifests["${direct_previous}"]=1

for manifest in "${!selected_manifests[@]}"; do
  protect_manifest_images "${manifest}"
done
for image in "${extra_protected_images[@]}"; do
  case "${image}" in
    "${backend_repository}"@sha256:*)
      validate_image_for_service backend "${image}" || die "额外保护镜像无效" 64
      ;;
    "${admin_repository}"@sha256:*)
      validate_image_for_service admin "${image}" || die "额外保护镜像无效" 64
      ;;
    "${eap_repository}"@sha256:*)
      validate_image_for_service eap "${image}" || die "额外保护镜像无效" 64
      ;;
    *)
      die "额外保护镜像不属于固定测试仓库" 64
      ;;
  esac
  protected_images["${image}"]=1
done

for repository in \
  "${backend_repository}" "${admin_repository}" "${eap_repository}"; do
  image_listing="$(
    docker image ls \
      --digests \
      --no-trunc \
      --format '{{.Repository}}\t{{.Digest}}' \
      "${repository}"
  )" || die "无法枚举固定测试仓库镜像：${repository}" 69
  while IFS=$'\t' read -r listed_repository digest; do
    [[ "${listed_repository}" == "${repository}" ]] || continue
    [[ "${digest}" =~ ^sha256:[0-9a-f]{64}$ ]] || continue
    image="${repository}@${digest}"
    [[ -n "${protected_images["${image}"]+x}" ]] && continue
    candidate_images["${image}"]=1
  done <<<"${image_listing}"
done

removed=0
skipped=0
for image in "${!candidate_images[@]}"; do
  case "${image}" in
    "${backend_repository}"@sha256:*|"${admin_repository}"@sha256:*|"${eap_repository}"@sha256:*)
      ;;
    *)
      die "内部候选集出现非固定测试仓库镜像，拒绝清理" 78
      ;;
  esac
  source_label="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.source" }}' \
      "${image}" 2>/dev/null || true
  )"
  if [[ "${source_label}" != "${expected_source}" ]]; then
    warn "跳过 source 标签不匹配的镜像：${image}"
    ((skipped += 1))
    continue
  fi
  if ! container_ids="$(docker ps -aq --filter "ancestor=${image}")"; then
    warn "无法确认镜像是否被容器引用，安全跳过：${image}"
    ((skipped += 1))
    continue
  fi
  if [[ -n "${container_ids}" ]]; then
    warn "跳过仍被容器引用的测试镜像：${image}"
    ((skipped += 1))
    continue
  fi
  if [[ "${apply}" == false ]]; then
    info "DRY-RUN 将删除未受保护的测试镜像：${image}"
    ((removed += 1))
    continue
  fi
  if docker image rm -- "${image}" >/dev/null; then
    info "已删除未受保护的测试镜像：${image}"
    ((removed += 1))
  else
    warn "测试镜像删除失败，未执行强制删除：${image}"
    ((skipped += 1))
  fi
done

info "测试镜像清理完成：候选处理 ${removed}，安全跳过 ${skipped}"
