#!/bin/bash

# Source artifact for the one-time host installer. At runtime sshd/sudo must
# execute only the installed root-owned copy under /usr/local.
set -Eeuo pipefail
umask 077
readonly safe_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
PATH="${safe_path}"
export PATH
unset BASH_ENV ENV CDPATH GLOBIGNORE
unset COMPOSE_FILE COMPOSE_PATH_SEPARATOR COMPOSE_PROFILES COMPOSE_PROJECT_NAME
unset DOCKER_CERT_PATH DOCKER_CONTEXT DOCKER_HOST DOCKER_TLS_VERIFY
unset PYTHONHOME PYTHONPATH SSL_CERT_FILE SSL_CERT_DIR
unset OPENSSL_CONF OPENSSL_MODULES
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY
unset http_proxy https_proxy all_proxy no_proxy TMPDIR
IFS=$' \t\n'

readonly backend_repository="ghcr.io/yuanyuan152/wechat-appointment-mini-program/backend-test"
readonly admin_repository="ghcr.io/yuanyuan152/wechat-appointment-mini-program/admin-test"
readonly eap_repository="ghcr.io/yuanyuan152/wechat-appointment-mini-program/eap-test"
readonly bundle_dir="/etc/mini-program-actions/test"
readonly compose_file="${bundle_dir}/compose.yml"
readonly environment_file="${bundle_dir}/test.env"
readonly smoke_script="${bundle_dir}/smoke-test.sh"
readonly cleanup_script="${bundle_dir}/cleanup-test-images.sh"
readonly restore_script="${bundle_dir}/restore-test-release.sh"
readonly oidc_verifier="${bundle_dir}/verify-github-oidc.py"
readonly bundle_integrity="${bundle_dir}/bundle.integrity"
readonly policy_dir="/etc/mini-program-actions"
readonly actions_ready_marker="${policy_dir}/test-actions-ready"
readonly actions_deploying_marker="${policy_dir}/test-actions-deploying"
readonly actions_only_marker="${policy_dir}/test-actions-only"
readonly state_dir="/data/mini_program/deployments/test"
readonly history_dir="${state_dir}/history"
readonly current_manifest="${state_dir}/current.env"
readonly lock_dir="/run/lock/mini-program-actions"
readonly lock_file="${lock_dir}/test.lock"
readonly project_name="mini-test"
readonly installed_gateway="/usr/local/libexec/mini-program-actions/actions-test-gateway.sh"
readonly expected_source="https://github.com/YuanYuan152/WeChat-Appointment-Mini-Program"
readonly policy_version="actions-test-v1"
readonly pre_pull_minimum_kib=10485760
readonly post_pull_minimum_kib=5242880

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

sha256_file() {
  sha256sum --binary -- "$1" | awk '{ print $1 }'
}

verify_bundle_integrity() {
  local line key value
  local expected_policy=""
  local expected_gateway=""
  local expected_compose=""
  local expected_smoke=""
  local expected_cleanup=""
  local expected_restore=""
  local expected_oidc=""
  local seen_policy=0
  local seen_gateway=0
  local seen_compose=0
  local seen_smoke=0
  local seen_cleanup=0
  local seen_restore=0
  local seen_oidc=0

  assert_root_owned_file "${bundle_integrity}" "固定 bundle 完整性清单"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" == *=* ]] || die "固定 bundle 完整性清单格式无效" 78
    key="${line%%=*}"
    value="${line#*=}"
    case "${key}" in
      POLICY_VERSION)
        ((seen_policy += 1))
        expected_policy="${value}"
        ;;
      GATEWAY_SHA256)
        ((seen_gateway += 1))
        expected_gateway="${value}"
        ;;
      COMPOSE_SHA256)
        ((seen_compose += 1))
        expected_compose="${value}"
        ;;
      SMOKE_SHA256)
        ((seen_smoke += 1))
        expected_smoke="${value}"
        ;;
      CLEANUP_SHA256)
        ((seen_cleanup += 1))
        expected_cleanup="${value}"
        ;;
      RESTORE_SHA256)
        ((seen_restore += 1))
        expected_restore="${value}"
        ;;
      OIDC_SHA256)
        ((seen_oidc += 1))
        expected_oidc="${value}"
        ;;
      *)
        die "固定 bundle 完整性清单包含未知字段：${key}" 78
        ;;
    esac
  done <"${bundle_integrity}"

  [[ "${seen_policy}" == 1 && "${expected_policy}" == "${policy_version}" ]] \
    || die "固定 bundle 策略版本不匹配" 78
  for count in \
    "${seen_gateway}" "${seen_compose}" "${seen_smoke}" \
    "${seen_cleanup}" "${seen_restore}" "${seen_oidc}"; do
    [[ "${count}" == 1 ]] || die "固定 bundle 完整性字段必须且只能出现一次" 78
  done
  for checksum in \
    "${expected_gateway}" "${expected_compose}" "${expected_smoke}" \
    "${expected_cleanup}" "${expected_restore}" "${expected_oidc}"; do
    [[ "${checksum}" =~ ^[0-9a-f]{64}$ ]] \
      || die "固定 bundle SHA-256 格式无效" 78
  done

  [[ "$(sha256_file "${installed_gateway}")" == "${expected_gateway}" ]] \
    || die "固定部署网关完整性校验失败" 78
  [[ "$(sha256_file "${compose_file}")" == "${expected_compose}" ]] \
    || die "固定 Compose 完整性校验失败" 78
  [[ "$(sha256_file "${smoke_script}")" == "${expected_smoke}" ]] \
    || die "固定健康检查脚本完整性校验失败" 78
  [[ "$(sha256_file "${cleanup_script}")" == "${expected_cleanup}" ]] \
    || die "固定镜像清理脚本完整性校验失败" 78
  [[ "$(sha256_file "${restore_script}")" == "${expected_restore}" ]] \
    || die "固定恢复脚本完整性校验失败" 78
  [[ "$(sha256_file "${oidc_verifier}")" == "${expected_oidc}" ]] \
    || die "固定 GitHub OIDC 校验器完整性校验失败" 78
}

validate_digest() {
  [[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]] \
    || die "镜像 digest 必须是 sha256: 加 64 位小写十六进制" 64
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

write_manifest() {
  local destination="$1"
  local version="$2"
  local backend_image="$3"
  local admin_image="$4"
  local eap_image="$5"
  local run_id="$6"
  local run_attempt="$7"
  local deployed_at="$8"

  manifest_temporary="$(mktemp "${state_dir}/.manifest.XXXXXX")"
  {
    printf 'ENVIRONMENT=test\n'
    printf 'POLICY_VERSION=%s\n' "${policy_version}"
    printf 'VERSION=%s\n' "${version}"
    printf 'BACKEND_IMAGE=%s\n' "${backend_image}"
    printf 'ADMIN_IMAGE=%s\n' "${admin_image}"
    printf 'EAP_IMAGE=%s\n' "${eap_image}"
    printf 'GITHUB_RUN_ID=%s\n' "${run_id}"
    printf 'GITHUB_RUN_ATTEMPT=%s\n' "${run_attempt}"
    printf 'DEPLOYED_AT=%s\n' "${deployed_at}"
    printf 'DATABASE_CHANGED=false\n'
  } >"${manifest_temporary}"
  chmod 0640 "${manifest_temporary}"
  mv -f -- "${manifest_temporary}" "${destination}"
  manifest_temporary=""
}

load_manifest() {
  local path="$1"
  local line key value
  local environment=""
  local manifest_policy_version=""
  local version=""
  local backend_image=""
  local admin_image=""
  local eap_image=""
  local seen_environment=0
  local seen_policy_version=0
  local seen_version=0
  local seen_backend=0
  local seen_admin=0
  local seen_eap=0
  local run_id=""
  local run_attempt=""
  local deployed_at=""
  local database_changed=""
  local seen_run_id=0
  local seen_run_attempt=0
  local seen_deployed_at=0
  local seen_database_changed=0

  assert_root_owned_file "${path}" "部署清单"
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" == *=* ]] || die "部署清单格式无效" 78
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
    || die "部署清单环境无效" 78
  [[ "${seen_policy_version}" == 1 \
    && "${manifest_policy_version}" == "${policy_version}" ]] \
    || die "部署清单策略版本无效" 78
  [[ "${seen_version}" == 1 && "${version}" =~ ^[0-9a-f]{40}$ ]] \
    || die "部署清单版本无效" 78
  if [[ "${seen_backend}" != 1 ]] \
    || ! validate_image_for_service backend "${backend_image}"; then
    die "部署清单 backend 镜像无效" 78
  fi
  if [[ "${seen_admin}" != 1 ]] \
    || ! validate_image_for_service admin "${admin_image}"; then
    die "部署清单 admin 镜像无效" 78
  fi
  if [[ "${seen_eap}" != 1 ]] \
    || ! validate_image_for_service eap "${eap_image}"; then
    die "部署清单 eap 镜像无效" 78
  fi
  [[ "${seen_run_id}" == 1 \
    && "${run_id}" =~ ^(0|[1-9][0-9]{0,19})$ ]] \
    || die "部署清单 GITHUB_RUN_ID 无效" 78
  [[ "${seen_run_attempt}" == 1 \
    && "${run_attempt}" =~ ^(0|[1-9][0-9]{0,5})$ ]] \
    || die "部署清单 GITHUB_RUN_ATTEMPT 无效" 78
  [[ "${seen_deployed_at}" == 1 \
    && "${deployed_at}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] \
    || die "部署清单 DEPLOYED_AT 无效" 78
  [[ "${seen_database_changed}" == 1 && "${database_changed}" == false ]] \
    || die "部署清单必须明确 DATABASE_CHANGED=false" 78

  MANIFEST_VERSION="${version}"
  MANIFEST_BACKEND_IMAGE="${backend_image}"
  MANIFEST_ADMIN_IMAGE="${admin_image}"
  MANIFEST_EAP_IMAGE="${eap_image}"
}

running_image_for_service() {
  local service="$1"
  local container_ids
  local container_id
  local count
  local health_status
  local configured_user
  local container_image
  local expected_user

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
    # The one-time rollback baseline may be the trusted pre-Actions image,
    # whose Dockerfile used a user name. All GHCR/ACTIONS containers must be
    # pinned by the root-owned Compose to an exact numeric uid:gid.
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
  local expected_backend_image="$1"
  local expected_admin_image="$2"
  local expected_eap_image="$3"
  local actual_backend_image
  local actual_admin_image
  local actual_eap_image

  actual_backend_image="$(running_image_for_service backend)" || {
    warn "无法确认 backend 容器唯一、健康且正在运行"
    return 1
  }
  actual_admin_image="$(running_image_for_service admin)" || {
    warn "无法确认 admin 容器唯一、健康且正在运行"
    return 1
  }
  actual_eap_image="$(running_image_for_service eap)" || {
    warn "无法确认 eap 容器唯一、健康且正在运行"
    return 1
  }

  [[ "${actual_backend_image}" == "${expected_backend_image}" ]] || {
    warn "backend 运行镜像与目标不可变镜像引用不一致"
    return 1
  }
  [[ "${actual_admin_image}" == "${expected_admin_image}" ]] || {
    warn "admin 运行镜像与目标不可变镜像引用不一致"
    return 1
  }
  [[ "${actual_eap_image}" == "${expected_eap_image}" ]] || {
    warn "eap 运行镜像与目标不可变镜像引用不一致"
    return 1
  }
}

bootstrap_current_manifest() {
  local backend_image admin_image eap_image
  local backend_version admin_version eap_version
  local backend_label_version admin_label_version eap_label_version
  local backend_source admin_source eap_source

  backend_image="$(running_image_for_service backend)" || return 1
  admin_image="$(running_image_for_service admin)" || return 1
  eap_image="$(running_image_for_service eap)" || return 1
  validate_image_for_service backend "${backend_image}" || return 1
  validate_image_for_service admin "${admin_image}" || return 1
  validate_image_for_service eap "${eap_image}" || return 1

  backend_version="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.revision" }}' \
      "${backend_image}"
  )"
  admin_version="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.revision" }}' \
      "${admin_image}"
  )"
  eap_version="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.revision" }}' \
      "${eap_image}"
  )"
  backend_label_version="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.version" }}' \
      "${backend_image}"
  )"
  admin_label_version="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.version" }}' \
      "${admin_image}"
  )"
  eap_label_version="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.version" }}' \
      "${eap_image}"
  )"
  backend_source="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.source" }}' \
      "${backend_image}"
  )"
  admin_source="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.source" }}' \
      "${admin_image}"
  )"
  eap_source="$(
    docker image inspect --format \
      '{{ index .Config.Labels "org.opencontainers.image.source" }}' \
      "${eap_image}"
  )"
  [[ "${backend_version}" =~ ^[0-9a-f]{40}$ ]] || return 1
  [[ "${backend_version}" == "${admin_version}" \
    && "${backend_version}" == "${eap_version}" ]] || return 1
  [[ "${backend_label_version}" == "${backend_version}" \
    && "${admin_label_version}" == "${backend_version}" \
    && "${eap_label_version}" == "${backend_version}" ]] || return 1
  for source in "${backend_source}" "${admin_source}" "${eap_source}"; do
    [[ -z "${source}" || "${source}" == "${expected_source}" ]] || return 1
  done
  if [[ "${backend_image}" == ghcr.io/* \
    || "${admin_image}" == ghcr.io/* \
    || "${eap_image}" == ghcr.io/* ]]; then
    [[ "${backend_source}" == "${expected_source}" \
      && "${admin_source}" == "${expected_source}" \
      && "${eap_source}" == "${expected_source}" ]] || return 1
  fi
  "${smoke_script}" --allow-missing-version "${backend_version}" || return 1

  info "从当前三个应用容器建立首次自动部署回滚点：${backend_version}"
  write_manifest \
    "${current_manifest}" "${backend_version}" \
    "${backend_image}" "${admin_image}" "${eap_image}" \
    0 0 "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}

verify_pulled_image() {
  local image="$1"
  local expected_version="$2"
  local revision source version

  docker pull --quiet "${image}" >/dev/null
  docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' \
    "${image}" | grep -Fx -- "${image}" >/dev/null \
    || die "拉取后的镜像 RepoDigest 与请求不一致：${image}" 65
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
    || die "镜像 OCI 版本标签与请求 SHA 不一致：${image}" 65
  [[ "${source}" == "${expected_source}" ]] \
    || die "镜像 OCI source 标签不属于固定代码仓库：${image}" 65
}

docker_available_kib() {
  local docker_root
  local available

  docker_root="$(docker info --format '{{.DockerRootDir}}')"
  [[ "${docker_root}" == /* && -d "${docker_root}" && ! -L "${docker_root}" ]] \
    || die "无法确认 Docker Root Dir 的真实目录" 78
  available="$(
    df -Pk -- "${docker_root}" \
      | awk 'NR == 2 { print $4 }'
  )"
  [[ "${available}" =~ ^[0-9]+$ ]] \
    || die "无法读取 Docker 存储文件系统的可用空间" 78
  printf '%s\n' "${available}"
}

require_docker_space() {
  local minimum_kib="$1"
  local stage="$2"
  local available_kib

  available_kib="$(docker_available_kib)"
  if ((available_kib < minimum_kib)); then
    warn "${stage} Docker 存储可用空间不足：$((available_kib / 1048576)) GiB，最低要求 $((minimum_kib / 1048576)) GiB"
    return 1
  fi
  info "${stage} Docker 存储可用空间：$((available_kib / 1048576)) GiB"
}

require_post_pull_space_or_abort() {
  local image_label="$1"

  if require_docker_space "${post_pull_minimum_kib}" "${image_label} 拉取后"; then
    return 0
  fi
  "${cleanup_script}" --lock-held --apply \
    || warn "拉取后空间不足，且无法完整清理由本次新增的未使用镜像"
  die "${image_label} 拉取后 Docker 存储不足 5 GiB，未变更运行容器" 75
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

rollback_previous() {
  local reason="$1"
  local smoke_arguments=("${MANIFEST_VERSION}")

  trap - ERR HUP INT TERM
  set +e
  warn "${reason}；开始回滚到 ${MANIFEST_VERSION}"
  for image in \
    "${MANIFEST_BACKEND_IMAGE}" \
    "${MANIFEST_ADMIN_IMAGE}" \
    "${MANIFEST_EAP_IMAGE}"; do
    if ! docker image inspect "${image}" >/dev/null 2>&1; then
      if [[ "${image}" == ghcr.io/*@sha256:* ]]; then
        docker pull --quiet "${image}" >/dev/null || {
          warn "无法取得回滚镜像：${image}"
          return 1
        }
      else
        warn "本地回滚镜像不存在：${image}"
        return 1
      fi
    fi
  done
  if [[ "${MANIFEST_BACKEND_IMAGE}" == mini-test-backend:* \
    || "${MANIFEST_ADMIN_IMAGE}" == mini-test-admin:* \
    || "${MANIFEST_EAP_IMAGE}" == mini-test-eap:* ]]; then
    smoke_arguments=(--allow-missing-version "${MANIFEST_VERSION}")
  fi
  if ! compose_up \
      "${MANIFEST_VERSION}" \
      "${MANIFEST_BACKEND_IMAGE}" \
      "${MANIFEST_ADMIN_IMAGE}" \
      "${MANIFEST_EAP_IMAGE}"; then
    warn "回滚容器更新失败"
    return 1
  fi
  if ! verify_running_images \
      "${MANIFEST_BACKEND_IMAGE}" \
      "${MANIFEST_ADMIN_IMAGE}" \
      "${MANIFEST_EAP_IMAGE}"; then
    warn "回滚后的运行容器未精确使用 current manifest 镜像"
    return 1
  fi
  if ! "${smoke_script}" "${smoke_arguments[@]}"; then
    warn "回滚后的应用健康检查失败"
    return 1
  fi
  if [[ -n "${previous_manifest_snapshot:-}" \
    && -f "${previous_manifest_snapshot}" ]]; then
    restored_manifest="$(mktemp "${state_dir}/.restore.XXXXXX")"
    if ! install -o root -g root -m 0640 \
        "${previous_manifest_snapshot}" "${restored_manifest}" \
      || ! mv -f -- "${restored_manifest}" "${current_manifest}"; then
      rm -f -- "${restored_manifest}"
      warn "应用已恢复，但 current manifest 恢复失败"
      return 1
    fi
  fi
  if [[ -n "${pending_history:-}" && -f "${pending_history}" ]]; then
    rm -f -- "${pending_history}"
    pending_history=""
  fi
  return 0
}

deployment_started=false
handle_signal() {
  local signal_name="$1"
  local exit_code="$2"

  trap - HUP INT TERM
  if [[ "${deployment_started}" == true ]]; then
    rollback_previous "部署收到 ${signal_name} 信号" \
      || warn "信号触发的自动回滚失败，需要人工介入"
  fi
  exit "${exit_code}"
}

parse_ssh_command() {
  local original_command="$1"

  if [[ "${original_command}" =~ ^deploy-test[[:space:]]+(actions-test-v1)[[:space:]]+([0-9a-f]{40})[[:space:]]+(sha256:[0-9a-f]{64})[[:space:]]+(sha256:[0-9a-f]{64})[[:space:]]+(sha256:[0-9a-f]{64})[[:space:]]+([0-9]{1,20})[[:space:]]+([1-9][0-9]{0,5})[[:space:]]+([A-Za-z0-9-]{1,39})$ ]]; then
    requested_policy_version="${BASH_REMATCH[1]}"
    release_sha="${BASH_REMATCH[2]}"
    backend_digest="${BASH_REMATCH[3]}"
    admin_digest="${BASH_REMATCH[4]}"
    eap_digest="${BASH_REMATCH[5]}"
    run_id="${BASH_REMATCH[6]}"
    run_attempt="${BASH_REMATCH[7]}"
    github_actor="${BASH_REMATCH[8]}"
  else
    die "仅允许：deploy-test actions-test-v1 <40位SHA> <backend digest> <admin digest> <eap digest> <run_id> <attempt> <actor>" 64
  fi
}

# Phase one runs as the unprivileged forced-command SSH user. It accepts no
# positional arguments, validates the server-provided SSH_ORIGINAL_COMMAND,
# then passes only validated scalar values to the exact sudoers command.
if [[ "${EUID}" -ne 0 ]]; then
  [[ $# -eq 0 ]] || die "受限 SSH 入口不接受命令行参数" 64
  command -v readlink >/dev/null 2>&1 || die "服务器缺少命令：readlink" 69
  command -v stat >/dev/null 2>&1 || die "服务器缺少命令：stat" 69
  command -v sudo >/dev/null 2>&1 || die "服务器缺少命令：sudo" 69
  command -v timeout >/dev/null 2>&1 || die "服务器缺少命令：timeout" 69
  [[ "$(readlink -f -- "$0")" == "${installed_gateway}" ]] \
    || die "必须执行主机上 root-owned 的固定网关" 77
  assert_root_owned_file "${installed_gateway}" "固定部署网关"
  parse_ssh_command "${SSH_ORIGINAL_COMMAND:-}"
  exec timeout --foreground --signal=TERM --kill-after=8m 20m \
    sudo -n "${installed_gateway}" --root \
    "${requested_policy_version}" \
    "${release_sha}" \
    "${backend_digest}" \
    "${admin_digest}" \
    "${eap_digest}" \
    "${run_id}" \
    "${run_attempt}" \
    "${github_actor}"
fi

# Phase two runs as root. sudo does not preserve SSH_ORIGINAL_COMMAND; every
# positional value is revalidated before Docker access.
[[ $# -eq 9 && "$1" == "--root" ]] \
  || die "root 阶段仅接受固定 --root 部署参数" 64
shift
requested_policy_version="$1"
release_sha="$2"
backend_digest="$3"
admin_digest="$4"
eap_digest="$5"
run_id="$6"
run_attempt="$7"
github_actor="$8"
[[ "${requested_policy_version}" == "${policy_version}" ]] \
  || die "workflow 与主机 gateway 策略版本不匹配" 64
[[ "${release_sha}" =~ ^[0-9a-f]{40}$ ]] \
  || die "发布 SHA 必须是 40 位小写十六进制" 64
validate_digest "${backend_digest}"
validate_digest "${admin_digest}"
validate_digest "${eap_digest}"
[[ "${run_id}" =~ ^[0-9]{1,20}$ ]] || die "GitHub run_id 格式无效" 64
[[ "${run_attempt}" =~ ^[1-9][0-9]{0,5}$ ]] \
  || die "GitHub run attempt 格式无效" 64
[[ "${github_actor}" =~ ^[A-Za-z0-9-]{1,39}$ ]] \
  || die "GitHub actor 格式无效" 64

for command_name in \
  awk chmod curl date df docker env flock grep install mktemp mv rm \
  sha256sum stat timeout; do
  require_command "${command_name}"
done
[[ -x /usr/bin/openssl ]] || die "服务器缺少固定路径 /usr/bin/openssl" 69
[[ -x /usr/bin/python3 ]] || die "服务器缺少固定路径 /usr/bin/python3" 69
assert_root_owned_file "${installed_gateway}" "固定部署网关"

readonly backend_image="${backend_repository}@${backend_digest}"
readonly admin_image="${admin_repository}@${admin_digest}"
readonly eap_image="${eap_repository}@${eap_digest}"

assert_secure_directory "${bundle_dir}" "固定部署目录"
assert_root_owned_file "${compose_file}" "固定 Compose 文件"
assert_root_owned_file "${environment_file}" "测试环境配置"
assert_root_owned_file "${smoke_script}" "固定健康检查脚本"
assert_root_owned_file "${cleanup_script}" "固定测试镜像清理脚本"
assert_root_owned_file "${restore_script}" "固定恢复脚本"
assert_root_owned_file "${oidc_verifier}" "固定 GitHub OIDC 校验器"
assert_root_owned_file "${bundle_integrity}" "固定 bundle 完整性清单"
assert_secure_directory "${policy_dir}" "Actions 固定策略目录"
assert_root_owned_file "${actions_ready_marker}" "Actions ready 标记"
if [[ -e "${actions_only_marker}" ]]; then
  assert_root_owned_file "${actions_only_marker}" "Actions only 标记"
fi
(( (8#$(file_mode "${environment_file}") & 077) == 0 )) \
  || die "测试环境配置必须禁止 group/other 访问（期望 0600）" 78
[[ -x "${smoke_script}" ]] || die "固定健康检查脚本不可执行" 78
[[ -x "${cleanup_script}" ]] || die "固定测试镜像清理脚本不可执行" 78
[[ -x "${restore_script}" ]] || die "固定恢复脚本不可执行" 78
[[ -x "${oidc_verifier}" ]] || die "固定 GitHub OIDC 校验器不可执行" 78

assert_secure_directory "${state_dir}" "部署状态目录"
assert_secure_directory "${history_dir}" "部署历史目录"
if [[ ! -e "${lock_dir}" ]]; then
  install -d -o root -g root -m 0750 "${lock_dir}"
fi
assert_secure_directory "${lock_dir}" "部署锁目录"
exec 9>"${lock_file}"
flock -n 9 || die "已有测试环境部署正在执行" 75
verify_bundle_integrity

# GITHUB_TOKEN and the GitHub OIDC JWT are short-lived and arrive only on
# stdin. Neither is placed in SSH arguments, process environment, deployment
# state, or Docker's root home. The verifier consumes the entire remaining
# stdin itself, so a third line or a truncated JWT fails closed.
IFS= read -r -t 30 ghcr_token || die "30 秒内未收到短期 GITHUB_TOKEN" 65
[[ "${ghcr_token}" =~ ^[A-Za-z0-9_]{20,512}$ ]] \
  || die "短期 GITHUB_TOKEN 格式无效" 65
timeout --foreground --signal=TERM --kill-after=5s 35s \
  /usr/bin/env -i \
    PATH=/usr/bin:/bin \
    LANG=C \
    /usr/bin/python3 -I "${oidc_verifier}" \
    --release-sha "${release_sha}" \
    --run-id "${run_id}" \
    --run-attempt "${run_attempt}" \
    --actor "${github_actor}"
docker_config="$(mktemp -d /run/mini-program-ghcr.XXXXXX)"
chmod 0700 "${docker_config}"
previous_manifest_snapshot=""
pending_history=""
manifest_temporary=""
baseline_temporary=""
cleanup_runtime() {
  rm -rf -- "${docker_config}"
  rm -f -- "${actions_deploying_marker}"
  [[ -z "${previous_manifest_snapshot}" ]] \
    || rm -f -- "${previous_manifest_snapshot}"
  [[ -z "${pending_history}" ]] || rm -f -- "${pending_history}"
  [[ -z "${manifest_temporary}" ]] || rm -f -- "${manifest_temporary}"
  [[ -z "${baseline_temporary}" ]] || rm -f -- "${baseline_temporary}"
}
trap cleanup_runtime EXIT
install -o root -g root -m 0644 /dev/null "${actions_deploying_marker}"
export DOCKER_CONFIG="${docker_config}"
printf '%s\n' "${ghcr_token}" \
  | docker login ghcr.io --username "${github_actor}" --password-stdin >/dev/null
unset ghcr_token

if [[ ! -f "${current_manifest}" ]]; then
  bootstrap_current_manifest \
    || die "无法从当前容器建立安全回滚点；首次自动部署已在变更容器前中止" 78
fi
load_manifest "${current_manifest}"
previous_manifest_snapshot="$(mktemp "${state_dir}/.previous.XXXXXX")"
install -o root -g root -m 0640 \
  "${current_manifest}" "${previous_manifest_snapshot}"

running_backend_image="$(running_image_for_service backend || true)"
running_admin_image="$(running_image_for_service admin || true)"
running_eap_image="$(running_image_for_service eap || true)"
[[ "${running_backend_image}" == "${MANIFEST_BACKEND_IMAGE}" \
  && "${running_admin_image}" == "${MANIFEST_ADMIN_IMAGE}" \
  && "${running_eap_image}" == "${MANIFEST_EAP_IMAGE}" ]] \
  || die "当前应用容器必须健康且与 current manifest 一致；请先人工核对 break-glass 变更" 78

baseline_smoke_arguments=("${MANIFEST_VERSION}")
if [[ "${MANIFEST_BACKEND_IMAGE}" == mini-test-backend:* \
  || "${MANIFEST_ADMIN_IMAGE}" == mini-test-admin:* \
  || "${MANIFEST_EAP_IMAGE}" == mini-test-eap:* ]]; then
  baseline_smoke_arguments=(--allow-missing-version "${MANIFEST_VERSION}")
fi
"${smoke_script}" "${baseline_smoke_arguments[@]}" \
  || die "current manifest 对应的运行基线未通过健康检查，拒绝开始新部署" 78

if [[ "${MANIFEST_VERSION}" == "${release_sha}" \
  && "${MANIFEST_BACKEND_IMAGE}" == "${backend_image}" \
  && "${MANIFEST_ADMIN_IMAGE}" == "${admin_image}" \
  && "${MANIFEST_EAP_IMAGE}" == "${eap_image}" \
  && "${running_backend_image}" == "${backend_image}" \
  && "${running_admin_image}" == "${admin_image}" \
  && "${running_eap_image}" == "${eap_image}" ]]; then
  info "该 GitHub Actions 产物已经部署；仅重新执行健康检查"
  "${smoke_script}" "${release_sha}"
  install -o root -g root -m 0644 /dev/null "${actions_only_marker}"
  exit 0
fi

"${cleanup_script}" \
  --lock-held \
  --apply \
  --protect-image "${backend_image}" \
  --protect-image "${admin_image}" \
  --protect-image "${eap_image}"
require_docker_space "${pre_pull_minimum_kib}" "拉取前" \
  || die "保守清理后 Docker 存储仍不足 10 GiB，拒绝开始部署" 75

info "拉取并核验三个固定 GHCR 仓库的不可变 digest"
verify_pulled_image "${backend_image}" "${release_sha}"
require_post_pull_space_or_abort "Backend"
verify_pulled_image "${admin_image}" "${release_sha}"
require_post_pull_space_or_abort "Admin"
verify_pulled_image "${eap_image}" "${release_sha}"
require_post_pull_space_or_abort "EAP"
timeout --foreground --signal=TERM --kill-after=5s 20s \
  /usr/bin/env -i \
    PATH=/usr/bin:/bin \
    LANG=C \
    /usr/bin/python3 -I "${oidc_verifier}" \
    --current-only \
    --release-sha "${release_sha}"

baseline_history="${history_dir}/previous-${MANIFEST_VERSION}-before-run-${run_id}-${run_attempt}.env"
baseline_temporary="$(mktemp "${history_dir}/.previous.XXXXXX")"
install -o root -g root -m 0640 \
  "${previous_manifest_snapshot}" "${baseline_temporary}"
mv -f -- "${baseline_temporary}" "${baseline_history}"
baseline_temporary=""
assert_root_owned_file "${baseline_history}" "上一版本历史清单"

trap 'handle_signal HUP 129' HUP
trap 'handle_signal INT 130' INT
trap 'handle_signal TERM 143' TERM
deployment_started=true

handle_error() {
  local exit_code="$1"

  trap - ERR
  rollback_previous "部署过程发生未处理错误" \
    || warn "未处理错误后的自动回滚失败，需要人工介入"
  exit "${exit_code}"
}
trap 'handle_error $?' ERR

if ! compose_up \
  "${release_sha}" "${backend_image}" "${admin_image}" "${eap_image}"; then
  rollback_previous "应用容器更新失败" \
    || die "部署失败，且自动回滚失败，需要人工介入" 70
  die "部署失败，已回滚到 ${MANIFEST_VERSION}" 70
fi
if ! verify_running_images \
    "${backend_image}" "${admin_image}" "${eap_image}"; then
  rollback_previous "新版本运行容器未精确使用目标不可变镜像" \
    || die "运行镜像核验失败，且自动回滚失败，需要人工介入" 70
  die "运行镜像核验失败，已回滚到 ${MANIFEST_VERSION}" 70
fi
if ! "${smoke_script}" "${release_sha}"; then
  rollback_previous "新版本健康检查失败" \
    || die "健康检查失败，且自动回滚失败，需要人工介入" 70
  die "健康检查失败，已回滚到 ${MANIFEST_VERSION}" 70
fi
if ! timeout --foreground --signal=TERM --kill-after=5s 20s \
    /usr/bin/env -i \
      PATH=/usr/bin:/bin \
      LANG=C \
      /usr/bin/python3 -I "${oidc_verifier}" \
      --current-only \
      --release-sha "${release_sha}"; then
  rollback_previous "健康检查期间远程 dev 已更新" \
    || die "远程 dev 新鲜度核验失败，且自动回滚失败，需要人工介入" 70
  die "远程 dev 已更新；旧版本未提交为 current，已恢复上一版本" 75
fi

deployed_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
history_manifest="${history_dir}/${deployed_at//:/-}-${release_sha}-run-${run_id}-${run_attempt}.env"
pending_history="${history_manifest}"
write_manifest \
  "${history_manifest}" "${release_sha}" \
  "${backend_image}" "${admin_image}" "${eap_image}" \
  "${run_id}" "${run_attempt}" "${deployed_at}"
write_manifest \
  "${current_manifest}" "${release_sha}" \
  "${backend_image}" "${admin_image}" "${eap_image}" \
  "${run_id}" "${run_attempt}" "${deployed_at}"
install -o root -g root -m 0644 /dev/null "${actions_only_marker}"

deployment_started=false
pending_history=""
trap - ERR HUP INT TERM
if ! "${cleanup_script}" --lock-held --apply; then
  warn "部署已成功，但旧测试镜像清理失败；请安排人工 dry-run 检查"
fi
info "测试环境部署完成：${release_sha}（GitHub run ${run_id}, attempt ${run_attempt}）"
