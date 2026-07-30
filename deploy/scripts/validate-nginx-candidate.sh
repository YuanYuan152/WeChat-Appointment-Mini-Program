#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if (($# > 0)); then
  candidates=("$@")
else
  candidates=(
    "${REPO_ROOT}/deploy/nginx/mini-program-http-bootstrap.conf"
    "${REPO_ROOT}/deploy/nginx/mini-program.conf"
    "${REPO_ROOT}/deploy/nginx/mini-program-test-only-http-bootstrap.conf"
    "${REPO_ROOT}/deploy/nginx/mini-program-test-only.conf"
  )
fi

for candidate in "${candidates[@]}"; do
  if [[ ! -r "${candidate}" ]]; then
    printf 'ERROR: Nginx candidate is not readable: %s\n' "${candidate}" >&2
    exit 1
  fi
done

if ! command -v python3 >/dev/null 2>&1; then
  printf 'ERROR: python3 is required for the duplicate server_name check.\n' >&2
  exit 1
fi

if [[ -n "${NGINX_BIN:-}" ]]; then
  nginx_bin="${NGINX_BIN}"
elif command -v nginx >/dev/null 2>&1; then
  nginx_bin="$(command -v nginx)"
else
  printf 'ERROR: nginx is required. Set NGINX_BIN to a candidate validator binary.\n' >&2
  exit 1
fi

if [[ ! -x "${nginx_bin}" ]]; then
  printf 'ERROR: NGINX_BIN is not executable: %s\n' "${nginx_bin}" >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  printf 'ERROR: openssl is required to create an isolated throwaway certificate.\n' >&2
  exit 1
fi

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/mini-nginx-candidate.XXXXXX")"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

openssl req \
  -x509 \
  -newkey rsa:2048 \
  -nodes \
  -days 1 \
  -subj "/CN=nginx-candidate.invalid" \
  -keyout "${tmp_dir}/candidate.key" \
  -out "${tmp_dir}/candidate.crt" \
  >/dev/null 2>&1

# Simulate the production/legacy vhosts that remain installed while the
# test-only candidate is enabled. This catches accidental ownership of the
# default listener and http-context directive conflicts without reading or
# changing the target server.
legacy_fixture="${tmp_dir}/legacy-vhosts.conf"
cat >"${legacy_fixture}" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name legacy.invalid eap.ji-psy.com admin.ji-psy.com;
    return 204;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name legacy.invalid eap.ji-psy.com admin.ji-psy.com;
    ssl_certificate ${tmp_dir}/candidate.crt;
    ssl_certificate_key ${tmp_dir}/candidate.key;
    return 204;
}
EOF

check_duplicate_server_names() {
  local candidate="$1"
  python3 - "${candidate}" <<'PY'
from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

path = Path(sys.argv[1])
source = path.read_text(encoding="utf-8")
source = re.sub(r"(?m)#.*$", "", source)
tokens = re.findall(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[{};]|[^\s{};]+', source)


def unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


servers: list[tuple[list[str], list[str]]] = []
i = 0
while i < len(tokens):
    if tokens[i] != "server" or i + 1 >= len(tokens) or tokens[i + 1] != "{":
        i += 1
        continue

    depth = 1
    i += 2
    listens: list[str] = []
    names: list[str] = []
    while i < len(tokens) and depth:
        token = tokens[i]
        if token == "{":
            depth += 1
            i += 1
            continue
        if token == "}":
            depth -= 1
            i += 1
            continue
        if depth == 1 and token in {"listen", "server_name"}:
            directive = token
            values: list[str] = []
            i += 1
            while i < len(tokens) and tokens[i] != ";":
                values.append(unquote(tokens[i]))
                i += 1
            if directive == "listen" and values:
                listens.append(values[0])
            elif directive == "server_name":
                names.extend(values)
            if i < len(tokens):
                i += 1
            continue
        i += 1
    servers.append((listens, names))

owners: dict[tuple[str, str], list[int]] = defaultdict(list)
for server_index, (listens, names) in enumerate(servers, start=1):
    for listen in set(listens):
        for name in set(names):
            owners[(listen, name)].append(server_index)

duplicates = {
    key: indexes
    for key, indexes in owners.items()
    if len(set(indexes)) > 1
}
if duplicates:
    print(f"ERROR: duplicate server_name/listen pairs in {path}", file=sys.stderr)
    for (listen, name), indexes in sorted(duplicates.items()):
        joined = ", ".join(str(index) for index in indexes)
        print(
            f"  listen={listen!r} server_name={name!r} server_blocks={joined}",
            file=sys.stderr,
        )
    raise SystemExit(1)

print(f"OK: no duplicate server_name/listen pairs: {path}")
PY
}

check_test_only_scope() {
  local candidate="$1"
  python3 - "${candidate}" <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
source = path.read_text(encoding="utf-8")
source = re.sub(r"(?m)#.*$", "", source)

problems: list[str] = []
if re.search(r"\bdefault_server\b", source):
    problems.append("must not claim a default_server listener")
if re.search(r"(?m)^server_tokens\s+", source):
    problems.append("must not redeclare the legacy http-level server_tokens directive")

server_names: set[str] = set()
for value in re.findall(r"(?m)^\s*server_name\s+([^;]+);", source):
    server_names.update(value.split())

allowed_names = {"test.eap.ji-psy.com", "test.admin.ji-psy.com"}
unexpected_names = sorted(server_names - allowed_names)
missing_names = sorted(allowed_names - server_names)
if unexpected_names:
    problems.append(f"unexpected server_name values: {', '.join(unexpected_names)}")
if missing_names:
    problems.append(f"missing test server_name values: {', '.join(missing_names)}")

production_ports = sorted(
    set(re.findall(r"127\.0\.0\.1:(?:23000|23001|28000)\b", source))
)
if production_ports:
    problems.append(f"must not reference production upstreams: {', '.join(production_ports)}")

if problems:
    print(f"ERROR: test-only coexistence contract failed: {path}", file=sys.stderr)
    for problem in problems:
        print(f"  - {problem}", file=sys.stderr)
    raise SystemExit(1)

print(f"OK: test-only coexistence scope: {path}")
PY
}

prepare_isolated_candidate() {
  local source="$1"
  local destination="$2"
  local escaped_tmp
  escaped_tmp="${tmp_dir//\//\\/}"

  sed \
    -e "s#^[[:space:]]*ssl_certificate[[:space:]].*;#    ssl_certificate ${escaped_tmp}\\/candidate.crt;#" \
    -e "s#^[[:space:]]*ssl_certificate_key[[:space:]].*;#    ssl_certificate_key ${escaped_tmp}\\/candidate.key;#" \
    -e '/^[[:space:]]*include[[:space:]][[:space:]]*\/etc\/letsencrypt\/.*;[[:space:]]*$/d' \
    -e '/^[[:space:]]*ssl_dhparam[[:space:]].*;[[:space:]]*$/d' \
    -e "s#\\(access_log[[:space:]][[:space:]]*\\)[^[:space:];][^[:space:];]*#\\1${escaped_tmp}\\/access.log#g" \
    -e "s#\\(error_log[[:space:]][[:space:]]*\\)[^[:space:];][^[:space:];]*#\\1${escaped_tmp}\\/error.log#g" \
    "${source}" >"${destination}"
}

for candidate in "${candidates[@]}"; do
  check_duplicate_server_names "${candidate}"

  candidate_name="$(basename "${candidate}")"
  is_test_only=false
  case "${candidate_name}" in
    mini-program-test-only.conf|mini-program-test-only-http-bootstrap.conf)
      is_test_only=true
      check_test_only_scope "${candidate}"
      ;;
  esac

  isolated_candidate="${tmp_dir}/${candidate_name}"
  prepare_isolated_candidate "${candidate}" "${isolated_candidate}"

  wrapper="${tmp_dir}/${candidate_name}.nginx.conf"
  printf '%s\n' \
    'worker_processes 1;' \
    "pid ${tmp_dir}/${candidate_name}.pid;" \
    "error_log ${tmp_dir}/${candidate_name}.root-error.log notice;" \
    '' \
    'events {' \
    '    worker_connections 16;' \
    '}' \
    '' \
    'http {' \
    "    include ${isolated_candidate};" >"${wrapper}"

  if [[ "${is_test_only}" == true ]]; then
    printf '    include %s;\n' "${legacy_fixture}" >>"${wrapper}"
  fi
  printf '%s\n' '}' >>"${wrapper}"

  "${nginx_bin}" \
    -t \
    -e stderr \
    -p "${tmp_dir}/" \
    -c "${wrapper}"
done

printf 'OK: all candidate configurations passed isolated nginx -t.\n'
