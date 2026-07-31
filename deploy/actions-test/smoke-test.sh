#!/bin/bash

set -Eeuo pipefail

allow_missing_version=false
if [[ "${1:-}" == "--allow-missing-version" ]]; then
  allow_missing_version=true
  shift
fi
[[ $# -eq 1 && "$1" =~ ^[0-9a-f]{40}$ ]] || {
  printf '[ERROR] 用法：smoke-test.sh [--allow-missing-version] <40位小写Git SHA>\n' >&2
  exit 64
}

expected_version="$1"
tmp_dir="$(mktemp -d /tmp/mini-actions-smoke.XXXXXX)"
trap 'rm -rf -- "${tmp_dir}"' EXIT

check_json() {
  local name="$1"
  local url="$2"
  local service="$3"
  local environment="${4:-}"
  local output="${tmp_dir}/${name}.json"
  local status

  status="$(
    curl --silent --show-error --fail-with-body \
      --connect-timeout 3 --max-time 10 \
      --output "${output}" --write-out '%{http_code}' \
      "${url}" 2>/dev/null || true
  )"
  [[ "${status}" == "200" ]] || {
    printf '[ERROR] %s 健康检查失败：HTTP %s\n' \
      "${name}" "${status:-none}" >&2
    return 1
  }
  grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "${output}" \
    || return 1
  grep -Eq "\"service\"[[:space:]]*:[[:space:]]*\"${service}\"" "${output}" \
    || return 1
  if ! grep -Eq \
      "\"version\"[[:space:]]*:[[:space:]]*\"${expected_version}\"" \
      "${output}"; then
    [[ "${allow_missing_version}" == true ]] \
      && ! grep -Eq '"version"[[:space:]]*:' "${output}" \
      || return 1
  fi
  if [[ -n "${environment}" ]]; then
    grep -Eq \
      "\"environment\"[[:space:]]*:[[:space:]]*\"${environment}\"" \
      "${output}" || return 1
  fi
}

check_root_page() {
  local name="$1"
  local url="$2"
  local marker="$3"
  local output="${tmp_dir}/${name}.html"
  local metadata
  local status
  local content_type

  metadata="$(
    curl --silent --show-error --compressed \
      --connect-timeout 3 --max-time 10 \
      --output "${output}" \
      --write-out $'%{http_code}\t%{content_type}' \
      "${url}" 2>/dev/null || true
  )"
  status="${metadata%%$'\t'*}"
  content_type="${metadata#*$'\t'}"
  [[ "${status}" == "200" && "${content_type}" == text/html* ]] || {
    printf '[ERROR] %s 首页检查失败：HTTP %s, Content-Type %s\n' \
      "${name}" "${status:-none}" "${content_type:-none}" >&2
    return 1
  }
  grep -Fq "${marker}" "${output}" || {
    printf '[ERROR] %s 首页缺少预期站点标识\n' "${name}" >&2
    return 1
  }
}

check_json backend http://127.0.0.1:18000/health/ready backend test
check_json admin http://127.0.0.1:13001/health admin-web
check_json eap http://127.0.0.1:13000/health eap-front-site
check_root_page \
  admin-local-root \
  http://127.0.0.1:13001/ \
  "连心心理 Web 管理端"
check_root_page \
  eap-local-root \
  http://127.0.0.1:13000/ \
  "连心心理 | 专业心理咨询"

check_public_domain() {
  local domain="$1"
  local frontend_service="$2"
  local gate_status

  check_json \
    "${frontend_service}-public-health" \
    "https://${domain}/health" \
    "${frontend_service}"
  check_json \
    "${frontend_service}-public-backend" \
    "https://${domain}/healthz" \
    backend \
    test
  gate_status="$(
    curl --silent --show-error \
      --connect-timeout 3 --max-time 10 \
      --output /dev/null --write-out '%{http_code}' \
      "https://${domain}/" 2>/dev/null || true
  )"
  case "${gate_status}" in
    302|401|403)
      ;;
    *)
      printf '[ERROR] %s 公网首页未被访问控制保护：HTTP %s\n' \
        "${domain}" "${gate_status:-none}" >&2
      return 1
      ;;
  esac
}

public_ok=false
for attempt in {1..3}; do
  if check_public_domain \
      test.admin.ji-psy.com \
      admin-web \
    && check_public_domain \
      test.eap.ji-psy.com \
      eap-front-site; then
    public_ok=true
    break
  fi
  printf '[WARN] 公网测试入口尚未就绪（%s/3），5 秒后重试\n' \
    "${attempt}" >&2
  sleep 5
done
[[ "${public_ok}" == true ]] || {
  printf '[ERROR] 公网测试入口未切换到预期版本\n' >&2
  exit 1
}

printf '[INFO] 本机与公网测试环境健康检查通过：%s\n' \
  "${expected_version}" >&2
