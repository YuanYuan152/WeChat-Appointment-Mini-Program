#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

usage() {
  cat <<'EOF'
Usage:
  rollback.sh --environment test|production --target IMAGE_TAG [--apply]

The target must be an immutable image tag, normally a Git SHA. This script
rolls back backend/admin/eap images only. It never rolls back the database,
schema, uploads or assessment data.
EOF
}

environment=""
target=""
apply=false
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
    --target)
      [[ $# -ge 2 ]] || die "--target 缺少值"
      target="$2"
      shift 2
      ;;
    --apply)
      apply=true
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
validate_image_tag "${target}"
[[ "${target}" =~ ^[0-9a-f]{40}$ ]] \
  || die "回滚标签必须是完整的 40 位小写 Git SHA"
compose_file="${compose_file:-$(find_compose_file)}"
override_file="${override_file:-$(default_compose_override_for "${environment}")}"
env_file="${env_file:-$(default_env_file_for "${environment}")}"
project_name="$(project_name_for "${environment}")"

compose=(
  docker compose
  --project-name "${project_name}"
  --file "${compose_file}"
  --file "${override_file}"
  --env-file "${env_file}"
)
app_services=(backend admin eap)
wait_timeout="${DEPLOY_WAIT_TIMEOUT:-180}"
image_refs=(
  "mini-${environment}-backend:${target}"
  "mini-${environment}-admin:${target}"
  "mini-${environment}-eap:${target}"
)

if [[ "${apply}" == false ]]; then
  info "DRY-RUN：不会访问 Docker daemon、网络或数据库"
  info "将 ${environment} 应用镜像回滚到不可变标签 ${target}"
  print_command docker image inspect "${image_refs[@]}"
  info "将核对三个精确 RepoTag；若镜像有 OCI revision/version 标签，还会核对其 Git SHA"
  print_command env APP_VERSION="${target}" IMAGE_TAG="${target}" \
    "${compose[@]}" config --quiet
  print_command env APP_VERSION="${target}" IMAGE_TAG="${target}" \
    "${compose[@]}" up -d --no-deps --no-build --wait \
    --wait-timeout "${wait_timeout}" "${app_services[@]}"
  print_command "${SCRIPT_DIR}/smoke.sh" --environment "${environment}" \
    --expected-version "${target}" --run
  warn "数据库和文件数据不会回滚；若旧代码不兼容当前 schema，必须停止"
  exit 0
fi

"${SCRIPT_DIR}/preflight.sh" \
  --environment "${environment}" \
  --runtime \
  --compose-file "${compose_file}" \
  --override-file "${override_file}" \
  --env-file "${env_file}"

rendered_images="$(
  env APP_VERSION="${target}" IMAGE_TAG="${target}" \
    "${compose[@]}" config --images
)"
for image_ref in "${image_refs[@]}"; do
  grep -Fxq "${image_ref}" <<<"${rendered_images}" \
    || die "Compose 回滚配置未引用预期镜像：${image_ref}"
done

missing_revision_labels=0
for image_ref in "${image_refs[@]}"; do
  image_id="$(
    docker image inspect --format '{{.Id}}' "${image_ref}" 2>/dev/null || true
  )"
  [[ -n "${image_id}" ]] || die "本机缺少回滚镜像：${image_ref}"

  repo_tags="$(
    docker image inspect \
      --format '{{range .RepoTags}}{{println .}}{{end}}' \
      "${image_ref}"
  )"
  grep -Fxq "${image_ref}" <<<"${repo_tags}" \
    || die "镜像没有精确回滚标签 ${image_ref}"

  revision="$(
    docker image inspect \
      --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
      "${image_ref}" 2>/dev/null || true
  )"
  version="$(
    docker image inspect \
      --format '{{index .Config.Labels "org.opencontainers.image.version"}}' \
      "${image_ref}" 2>/dev/null || true
  )"
  [[ "${revision}" != "<no value>" ]] || revision=""
  [[ "${version}" != "<no value>" ]] || version=""

  if [[ -n "${revision}" ]]; then
    [[ "${revision}" =~ ^[0-9a-f]{40}$ ]] \
      || die "${image_ref} 的 OCI revision 不是完整 Git SHA：${revision}"
    [[ "${revision}" == "${target}" || "${revision}" == "${target}"* ]] \
      || die "${image_ref} 的 OCI revision=${revision} 与目标 ${target} 不一致"
  else
    missing_revision_labels=$((missing_revision_labels + 1))
  fi
  if [[ -n "${version}" && "${version}" =~ ^[0-9a-f]{12,40}$ ]]; then
    [[ "${version}" == "${target}" || "${version}" == "${target}"* ]] \
      || die "${image_ref} 的 OCI version=${version} 与目标 ${target} 不一致"
  fi

  info "已确认回滚镜像：${image_ref} -> ${image_id}"
done

if ((missing_revision_labels > 0)); then
  warn "${missing_revision_labels} 个镜像没有 OCI revision 标签；已使用精确不可变 RepoTag + 本地 image ID 做安全兜底"
fi

confirm_exact "ROLLBACK ${environment} TO ${target}"

env APP_VERSION="${target}" IMAGE_TAG="${target}" \
  "${compose[@]}" config --quiet
env APP_VERSION="${target}" IMAGE_TAG="${target}" \
  "${compose[@]}" up -d --no-deps --no-build --wait \
  --wait-timeout "${wait_timeout}" "${app_services[@]}"
"${SCRIPT_DIR}/smoke.sh" --environment "${environment}" \
  --expected-version "${target}" --run

info "${environment} 应用已回滚到 ${target}；数据库和持久化文件未变更"
