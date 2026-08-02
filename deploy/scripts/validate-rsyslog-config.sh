#!/usr/bin/env bash

set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  validate-rsyslog-config.sh --fragment PATH
  validate-rsyslog-config.sh --full-config PATH

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
command -v rsyslogd >/dev/null 2>&1 || die "rsyslogd is not installed"

if [[ "${mode}" == "fragment" ]]; then
  validation_level="2"
  validation_label="include fragment"
else
  validation_level="1"
  validation_label="full configuration"
fi

if ! validation_output="$(
  rsyslogd "-N${validation_level}" -f "${config_path}" 2>&1
)"; then
  printf 'rsyslog %s validation failed: %s\n' \
    "${validation_label}" "${config_path}" >&2
  printf '%s\n' "${validation_output}" >&2
  exit 1
fi

printf 'rsyslog %s validation passed: %s\n' \
  "${validation_label}" "${config_path}"
