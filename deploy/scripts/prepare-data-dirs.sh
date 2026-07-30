#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

usage() {
  cat <<'EOF'
Usage:
  prepare-data-dirs.sh --env-file FILE [--apply]

Reads only the dedicated persistent-directory settings from FILE. The default
is a dry-run. --apply creates the directories and makes their contents
writable by the backend/SQL Server container uid without starting Docker or
accessing a database.

Run the apply step as root, for example:
  sudo deploy/scripts/prepare-data-dirs.sh \
    --env-file deploy/env/test.env --apply
EOF
}

env_file=""
apply=false

while (($#)); do
  case "$1" in
    --env-file)
      [[ $# -ge 2 ]] || die "--env-file 缺少值"
      env_file="$2"
      shift 2
      ;;
    --apply)
      apply=true
      shift
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

[[ -n "${env_file}" ]] || die "必须指定 --env-file"
[[ -f "${env_file}" ]] || die "环境文件不存在：${env_file}"

data_root="$(read_env_value DATA_HOST_ROOT "${env_file}")"
data_uid="$(read_env_value DATA_DIR_UID "${env_file}")"
data_gid="$(read_env_value DATA_DIR_GID "${env_file}")"
directory_mode="$(read_env_value DATA_DIR_MODE "${env_file}")"
file_mode="$(read_env_value DATA_FILE_MODE "${env_file}")"

data_uid="${data_uid:-10001}"
data_gid="${data_gid:-10001}"
directory_mode="${directory_mode:-0750}"
file_mode="${file_mode:-0640}"

[[ "${data_root}" == /* && "${data_root}" != "/" ]] \
  || die "DATA_HOST_ROOT 必须是非根绝对路径"
[[ "${data_root}" != *"/../"* && "${data_root}" != */.. ]] \
  || die "DATA_HOST_ROOT 不能包含 .."
[[ "${data_uid}" =~ ^[0-9]+$ ]] || die "DATA_DIR_UID 必须是数字"
[[ "${data_gid}" =~ ^[0-9]+$ ]] || die "DATA_DIR_GID 必须是数字"
[[ "${directory_mode}" =~ ^0?[0-7]{3}$ ]] \
  || die "DATA_DIR_MODE 必须是三位或四位八进制权限"
[[ "${file_mode}" =~ ^0?[0-7]{3}$ ]] \
  || die "DATA_FILE_MODE 必须是三位或四位八进制权限"

path_keys=(
  UPLOAD_HOST_DIR
  ASSESSMENT_DATA_HOST_DIR
  ASSESSMENT_ASSET_HOST_DIR
  MSSQL_BACKUP_HOST_DIR
)
paths=()

for key in "${path_keys[@]}"; do
  path="$(read_env_value "${key}" "${env_file}")"
  [[ -n "${path}" ]] || die "${key} 不能为空"
  [[ "${path}" == "${data_root%/}/"* ]] \
    || die "${key} 必须位于 DATA_HOST_ROOT (${data_root}) 下"
  [[ "${path}" != *"/../"* && "${path}" != */.. ]] \
    || die "${key} 不能包含 .."
  paths+=("${path}")
done

if [[ "${apply}" == false ]]; then
  info "DRY-RUN：不会创建目录、修改权限、启动 Docker 或访问数据库"
  info "容器数据 uid:gid=${data_uid}:${data_gid}"
  for path in "${paths[@]}"; do
    printf '  prepare %q (directories %s, files %s)\n' \
      "${path}" "${directory_mode}" "${file_mode}"
  done
  info "实际执行需以 root 身份追加 --apply"
  exit 0
fi

[[ "$(id -u)" == "0" ]] || die "--apply 必须由 root 执行（请使用 sudo）"

if [[ -e "${data_root}" && ( ! -d "${data_root}" || -L "${data_root}" ) ]]; then
  die "DATA_HOST_ROOT 必须是普通目录，不能是文件或符号链接：${data_root}"
fi
mkdir -p -- "${data_root}"
for path in "${paths[@]}"; do
  if [[ -e "${path}" && ( ! -d "${path}" || -L "${path}" ) ]]; then
    die "拒绝处理文件或符号链接路径：${path}"
  fi
  mkdir -p -- "${path}"
  chown -R -- "${data_uid}:${data_gid}" "${path}"
  find -P "${path}" -type d -exec chmod "${directory_mode}" {} +
  find -P "${path}" -type f -exec chmod "${file_mode}" {} +
  info "已准备：${path}"
done

info "持久化目录准备完成；未启动 Docker 或访问数据库"
