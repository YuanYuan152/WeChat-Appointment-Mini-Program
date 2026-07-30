#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd -- "${DEPLOY_ROOT}/.." && pwd)"

info() {
  printf '[INFO] %s\n' "$*" >&2
}

warn() {
  printf '[WARN] %s\n' "$*" >&2
}

lowercase() {
  tr '[:upper:]' '[:lower:]' <<<"$1"
}

die() {
  printf '[ERROR] %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令：$1"
}

normalize_environment() {
  case "${1:-}" in
    test)
      printf 'test\n'
      ;;
    production)
      printf 'production\n'
      ;;
    *)
      die "环境只能是 test 或 production"
      ;;
  esac
}

project_name_for() {
  local environment
  environment="$(normalize_environment "$1")"
  if [[ -n "${COMPOSE_PROJECT_NAME:-}" ]]; then
    printf '%s\n' "${COMPOSE_PROJECT_NAME}"
  else
    printf 'mini-%s\n' "${environment}"
  fi
}

default_domains_for() {
  local environment
  environment="$(normalize_environment "$1")"
  if [[ "${environment}" == "test" ]]; then
    printf '%s %s\n' \
      "${TEST_EAP_DOMAIN:-test.eap.ji-psy.com}" \
      "${TEST_ADMIN_DOMAIN:-test.admin.ji-psy.com}"
  else
    printf '%s %s\n' \
      "${PRODUCTION_EAP_DOMAIN:-eap.ji-psy.com}" \
      "${PRODUCTION_ADMIN_DOMAIN:-admin.ji-psy.com}"
  fi
}

find_compose_file() {
  if [[ -n "${COMPOSE_FILE:-}" ]]; then
    printf '%s\n' "${COMPOSE_FILE}"
    return
  fi

  local candidate
  for candidate in \
    "${DEPLOY_ROOT}/compose.yml" \
    "${DEPLOY_ROOT}/compose.yaml" \
    "${DEPLOY_ROOT}/docker-compose.yml" \
    "${DEPLOY_ROOT}/docker-compose.yaml" \
    "${DEPLOY_ROOT}/compose/compose.yml" \
    "${DEPLOY_ROOT}/compose/compose.yaml" \
    "${DEPLOY_ROOT}/compose/docker-compose.yml" \
    "${DEPLOY_ROOT}/compose/docker-compose.yaml"; do
    if [[ -f "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return
    fi
  done

  # Keep dry-runs deterministic even before the Compose file is added.
  printf '%s\n' "${DEPLOY_ROOT}/compose.yml"
}

default_compose_override_for() {
  local environment
  environment="$(normalize_environment "$1")"
  printf '%s/compose.%s.yml\n' "${DEPLOY_ROOT}" "${environment}"
}

default_env_file_for() {
  local environment
  environment="$(normalize_environment "$1")"
  printf '%s/%s.env\n' "${DEPLOY_ENV_DIR:-${DEPLOY_ROOT}/env}" "${environment}"
}

compose_base_command() {
  local environment="$1"
  local compose_file="$2"
  local override_file="$3"
  local env_file="$4"
  local project_name
  project_name="$(project_name_for "${environment}")"

  printf 'docker compose --project-name %q --file %q' \
    "${project_name}" "${compose_file}"
  if [[ -n "${override_file}" ]]; then
    printf ' --file %q' "${override_file}"
  fi
  if [[ -n "${env_file}" ]]; then
    printf ' --env-file %q' "${env_file}"
  fi
  printf '\n'
}

print_command() {
  local argument
  printf '  '
  for argument in "$@"; do
    printf '%q ' "${argument}"
  done
  printf '\n'
}

confirm_exact() {
  local expected="$1"
  local supplied="${OPS_CONFIRMATION:-}"

  if [[ "${supplied}" == "${expected}" ]]; then
    return
  fi

  if [[ ! -t 0 ]]; then
    die "非交互执行必须设置 OPS_CONFIRMATION 为精确确认短语：${expected}"
  fi

  printf '请输入确认短语 [%s]：' "${expected}" >&2
  IFS= read -r supplied
  [[ "${supplied}" == "${expected}" ]] || die "确认短语不匹配，操作已取消"
}

validate_identifier() {
  local value="$1"
  local label="$2"
  [[ "${value}" =~ ^[A-Za-z][A-Za-z0-9_]{0,127}$ ]] \
    || die "${label} 仅允许字母开头及字母、数字、下划线，最长 128 字符"
}

validate_image_tag() {
  local value="$1"
  [[ "${value}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{6,127}$ ]] \
    || die "镜像标签格式无效；请使用至少 7 位的不可变 Git SHA 或版本标签"
  [[ "${value}" != "latest" ]] || die "禁止使用 latest 做回滚目标"
}

validate_backup_name() {
  local value="$1"
  [[ "${value}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*\.bak$ ]] \
    || die "备份文件名不安全，仅允许字母、数字、点、下划线、横线，并以 .bak 结尾"
  [[ "${value}" != *".."* ]] || die "备份文件名不能包含 .."
}

file_mode() {
  local path="$1"
  if stat -c '%a' "${path}" >/dev/null 2>&1; then
    stat -c '%a' "${path}"
  else
    stat -f '%Lp' "${path}"
  fi
}

read_env_value() {
  local key="$1"
  local file="$2"
  local value
  value="$(
    awk -F= -v expected="${key}" '
      /^[[:space:]]*#/ { next }
      {
        current = $1
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", current)
        if (current == expected) {
          sub(/^[^=]*=/, "")
          print
          exit
        }
      }
    ' "${file}"
  )"
  value="${value%$'\r'}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s\n' "${value}"
}

resolve_host_ipv4() {
  local host="$1"
  if command -v getent >/dev/null 2>&1; then
    getent ahostsv4 "${host}" 2>/dev/null | awk 'NR == 1 { print $1 }'
  elif command -v dig >/dev/null 2>&1; then
    dig +short A "${host}" 2>/dev/null | awk 'NR == 1 { print $1 }'
  elif command -v host >/dev/null 2>&1; then
    host -t A "${host}" 2>/dev/null | awk '/has address/ { print $4; exit }'
  fi
}
