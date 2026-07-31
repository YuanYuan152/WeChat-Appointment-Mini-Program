#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

usage() {
  cat <<'EOF'
Usage:
  smoke.sh --environment test|production|all [--run] [options]

Default behavior is a dry-run. --run performs only unauthenticated HTTP/TLS
checks; it does not submit forms or call authenticated business endpoints.

Options:
  --expected-version SHA  Require frontend /health and backend /healthz to
                          report this APP_VERSION
  --public-ip ADDRESS     Verify the IP default vhost does not serve the app
EOF
}

environment=""
run=false
public_ip="${DEPLOY_PUBLIC_IP:-}"
expected_version="${EXPECTED_APP_VERSION:-}"

while (($#)); do
  case "$1" in
    --environment)
      [[ $# -ge 2 ]] || die "--environment 缺少值"
      environment="$2"
      shift 2
      ;;
    --run)
      run=true
      shift
      ;;
    --expected-version)
      [[ $# -ge 2 ]] || die "--expected-version 缺少值"
      expected_version="$2"
      shift 2
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

case "${environment}" in
  test|production)
    environments=("${environment}")
    ;;
  all)
    environments=(test production)
    ;;
  *)
    die "环境只能是 test、production 或 all"
    ;;
esac

if [[ -n "${expected_version}" ]]; then
  [[ "${expected_version}" =~ ^[0-9a-f]{40}$ ]] \
    || die "预期版本必须是完整的 40 位小写 Git SHA"
fi

if [[ "${run}" == false ]]; then
  info "DRY-RUN：不会发起 HTTP、TLS 或数据库请求"
  for item in "${environments[@]}"; do
    read -r eap_domain admin_domain <<<"$(default_domains_for "${item}")"
    for domain in "${eap_domain}" "${admin_domain}"; do
      printf '  检查 http://%s/ 为 301 到 HTTPS\n' "${domain}"
      printf '  检查 https://%s/ 返回 200、HTML 且包含对应站点标题\n' "${domain}"
      printf '  检查 https://%s/health 返回 200 且标识对应前端服务\n' "${domain}"
      if [[ -n "${expected_version}" ]]; then
        printf '  检查 https://%s/health 报告版本 %s\n' \
          "${domain}" "${expected_version}"
      fi
      printf '  检查 https://%s/healthz 返回 200 且后端状态、环境正确\n' "${domain}"
      if [[ -n "${expected_version}" ]]; then
        printf '  检查 https://%s/healthz 报告版本 %s\n' \
          "${domain}" "${expected_version}"
      fi
      printf '  检查 %s TLS 证书包含该域名\n' "${domain}"
    done
  done
  if [[ -n "${public_ip}" ]]; then
    printf '  检查 http://%s/ 不返回 EAP/Admin 页面\n' "${public_ip}"
  fi
  exit 0
fi

require_command curl
require_command openssl

failures=0
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/mini-smoke.XXXXXX")"
trap 'rm -rf -- "${tmp_dir}"' EXIT

fetch_https() {
  local url="$1"
  local output_file="$2"
  local metadata

  metadata="$(
    curl --silent --show-error --compressed \
      --connect-timeout 5 --max-time 15 \
      --output "${output_file}" \
      --write-out $'%{http_code}\t%{content_type}' \
      "${url}" 2>/dev/null || true
  )"
  CURL_STATUS="${metadata%%$'\t'*}"
  if [[ "${metadata}" == *$'\t'* ]]; then
    CURL_CONTENT_TYPE="${metadata#*$'\t'}"
  else
    CURL_CONTENT_TYPE=""
  fi
}

check_domain() {
  local domain="$1"
  local expected_environment="$2"
  local frontend_service="$3"
  local page_marker="$4"
  local headers
  local status
  local location
  local body_file

  headers="$(curl --silent --show-error --head --max-time 10 \
    "http://${domain}/" 2>/dev/null || true)"
  status="$(awk 'NR == 1 { print $2 }' <<<"${headers}")"
  location="$(
    awk 'tolower($1) == "location:" { gsub("\r", "", $2); print $2; exit }' \
      <<<"${headers}"
  )"
  if [[ "${status}" != "301" || "${location}" != "https://${domain}/" ]]; then
    warn "${domain} HTTP 跳转异常：status=${status:-none}, location=${location:-none}"
    failures=$((failures + 1))
  fi

  body_file="${tmp_dir}/${domain}.root"
  fetch_https "https://${domain}/" "${body_file}"
  if [[ "${CURL_STATUS}" != "200" ]]; then
    warn "${domain} HTTPS 首页必须直接返回 200，当前 status=${CURL_STATUS:-none}"
    failures=$((failures + 1))
  elif [[ "${CURL_CONTENT_TYPE}" != text/html* ]]; then
    warn "${domain} HTTPS 首页 Content-Type 异常：${CURL_CONTENT_TYPE:-none}"
    failures=$((failures + 1))
  elif ! grep -Fq "${page_marker}" "${body_file}"; then
    warn "${domain} HTTPS 首页未包含站点标识：${page_marker}"
    failures=$((failures + 1))
  fi

  body_file="${tmp_dir}/${domain}.front-health"
  fetch_https "https://${domain}/health" "${body_file}"
  if [[ "${CURL_STATUS}" != "200" ]]; then
    warn "${domain} /health 必须返回 200，当前 status=${CURL_STATUS:-none}"
    failures=$((failures + 1))
  elif [[ "${CURL_CONTENT_TYPE}" != application/json* ]] \
    || ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "${body_file}" \
    || ! grep -Eq \
      "\"service\"[[:space:]]*:[[:space:]]*\"${frontend_service}\"" \
      "${body_file}"; then
    warn "${domain} /health 未返回预期前端服务 ${frontend_service} 的健康 JSON"
    failures=$((failures + 1))
  elif [[ -n "${expected_version}" ]] \
    && ! grep -Eq \
      "\"version\"[[:space:]]*:[[:space:]]*\"${expected_version}\"" \
      "${body_file}"; then
    warn "${domain} /health 未报告预期版本 ${expected_version}"
    failures=$((failures + 1))
  fi

  body_file="${tmp_dir}/${domain}.backend-health"
  fetch_https "https://${domain}/healthz" "${body_file}"
  if [[ "${CURL_STATUS}" != "200" ]]; then
    warn "${domain} /healthz 必须返回 200，当前 status=${CURL_STATUS:-none}"
    failures=$((failures + 1))
  elif [[ "${CURL_CONTENT_TYPE}" != application/json* ]] \
    || ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "${body_file}" \
    || ! grep -Eq '"service"[[:space:]]*:[[:space:]]*"backend"' "${body_file}" \
    || ! grep -Eq \
      "\"environment\"[[:space:]]*:[[:space:]]*\"${expected_environment}\"" \
      "${body_file}"; then
    warn "${domain} /healthz 未返回 ${expected_environment} 后端的健康 JSON"
    failures=$((failures + 1))
  elif [[ -n "${expected_version}" ]] \
    && ! grep -Eq \
      "\"version\"[[:space:]]*:[[:space:]]*\"${expected_version}\"" \
      "${body_file}"; then
    warn "${domain} /healthz 未报告预期版本 ${expected_version}"
    failures=$((failures + 1))
  fi

  local cert_text
  cert_text="$(
    printf '' |
      openssl s_client -connect "${domain}:443" -servername "${domain}" \
        2>/dev/null |
      openssl x509 -noout -ext subjectAltName 2>/dev/null || true
  )"
  if ! grep -Fq "DNS:${domain}" <<<"${cert_text}"; then
    warn "${domain} TLS 证书 SAN 不包含该域名"
    failures=$((failures + 1))
  fi
}

for item in "${environments[@]}"; do
  read -r eap_domain admin_domain <<<"$(default_domains_for "${item}")"
  check_domain "${eap_domain}" "${item}" \
    "eap-front-site" "连心心理 | 专业心理咨询"
  check_domain "${admin_domain}" "${item}" \
    "admin-web" "连心心理 Web 管理端"
done

if [[ -n "${public_ip}" ]]; then
  status="$(curl --silent --show-error --head --max-time 5 \
    --output /dev/null --write-out '%{http_code}' \
    "http://${public_ip}/" 2>/dev/null || true)"
  if [[ "${status}" =~ ^(2|3) ]]; then
    warn "IP 默认入口返回 ${status}，可能仍落入业务站点"
    failures=$((failures + 1))
  fi
fi

((failures == 0)) || die "冒烟检查发现 ${failures} 个问题"
info "冒烟检查通过；未调用认证业务接口或修改数据库"
