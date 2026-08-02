#!/usr/bin/env bash

set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  validate-rsyslog-config.sh [--sudo] --fragment PATH
  validate-rsyslog-config.sh [--sudo] --full-config PATH

Validate an rsyslog include fragment with -N2, or an installed main
configuration with the stricter -N1 full-configuration check.
EOF
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

mode=""
config_path=""
use_sudo=false

while (($# > 0)); do
  case "$1" in
    --fragment)
      [[ $# -ge 2 ]] || die "--fragment requires a path"
      [[ -z "${mode}" ]] || die "choose exactly one validation mode"
      mode="fragment"
      config_path="$2"
      shift 2
      ;;
    --full-config)
      [[ $# -ge 2 ]] || die "--full-config requires a path"
      [[ -z "${mode}" ]] || die "choose exactly one validation mode"
      mode="full"
      config_path="$2"
      shift 2
      ;;
    --sudo)
      use_sudo=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

[[ -n "${mode}" ]] || die "a validation mode is required"
[[ -f "${config_path}" ]] || die "rsyslog configuration not found: ${config_path}"
rsyslog_bin="$(command -v rsyslogd || true)"
[[ -n "${rsyslog_bin}" ]] || die "rsyslogd is not installed"

validator=("${rsyslog_bin}")
if [[ "${use_sudo}" == true ]]; then
  command -v sudo >/dev/null 2>&1 || die "sudo is required for this validation"
  sudo -n true >/dev/null 2>&1 || die "passwordless sudo is required for this validation"
  validator=(sudo -n -- "${rsyslog_bin}")
fi

if [[ "${mode}" == "fragment" ]]; then
  validation_level="2"
  validation_label="include fragment"
  # Ubuntu's rsyslogd may drop to the syslog account even during validation.
  # GitHub's checkout parents are not traversable by that account, so validate
  # an exact, world-readable throwaway copy in /tmp rather than weakening the
  # repository permissions.
  validation_path="$(mktemp "${TMPDIR:-/tmp}/mini-rsyslog-fragment.XXXXXX.conf")"
  cleanup() {
    rm -f -- "${validation_path}"
  }
  trap cleanup EXIT
  cp -- "${config_path}" "${validation_path}"
  chmod 0644 "${validation_path}"
else
  validation_level="1"
  validation_label="full configuration"
  validation_path="${config_path}"
fi

if ! validation_output="$(
  "${validator[@]}" "-N${validation_level}" -f "${validation_path}" 2>&1
)"; then
  printf 'rsyslog %s validation failed: %s\n' \
    "${validation_label}" "${config_path}" >&2
  printf '%s\n' "${validation_output}" >&2
  exit 1
fi

printf 'rsyslog %s validation passed: %s\n' \
  "${validation_label}" "${config_path}"
