# syntax=docker/dockerfile:1.7

FROM python:3.11-slim-bookworm@sha256:b18992999dbe963a45a8a4da40ac2b1975be1a776d939d098c647482bcad5cba

ARG APP_VERSION=unknown
ARG VCS_REF=unknown
ARG DEBIAN_MIRROR=
ARG DEBIAN_SECURITY_MIRROR=

LABEL org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}"

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN set -eux; \
    if [ -n "${DEBIAN_MIRROR}" ]; then \
      for source_file in /etc/apt/sources.list /etc/apt/sources.list.d/*.sources; do \
        [ -f "${source_file}" ] || continue; \
        sed -E -i "s#https?://deb\\.debian\\.org/debian([[:space:]]|$)#${DEBIAN_MIRROR%/}\\1#g" "${source_file}"; \
      done; \
    fi; \
    if [ -n "${DEBIAN_SECURITY_MIRROR}" ]; then \
      for source_file in /etc/apt/sources.list /etc/apt/sources.list.d/*.sources; do \
        [ -f "${source_file}" ] || continue; \
        sed -E -i "s#https?://(deb\\.debian\\.org/debian-security|security\\.debian\\.org/debian-security)([[:space:]]|$)#${DEBIAN_SECURITY_MIRROR%/}\\2#g" "${source_file}"; \
      done; \
    fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg unixodbc; \
    curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
      | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg; \
    curl -fsSL https://packages.microsoft.com/config/debian/12/prod.list \
      -o /etc/apt/sources.list.d/mssql-release.list; \
    apt-get update; \
    ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/backend-python

ARG PIP_INDEX_URL=

COPY backend-python/requirements.txt /tmp/requirements.txt

# The repository currently stores this file as BOM-less UTF-16 LE. Normalize
# only the image-local copy so pip and Linux tooling receive deterministic
# UTF-8 input. Keep BOM support for future editors that may add one.
RUN python -c "from pathlib import Path; p=Path('/tmp/requirements.txt'); raw=p.read_bytes(); is_utf16=raw.startswith((b'\xff\xfe', b'\xfe\xff')) or b'\x00' in raw[:256]; text=raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-16-le') if is_utf16 else raw.decode('utf-8'); p.write_text(text, encoding='utf-8')" \
    && if [ -n "${PIP_INDEX_URL}" ]; then \
         python -m pip install --index-url "${PIP_INDEX_URL}" --requirement /tmp/requirements.txt; \
       else \
         python -m pip install --requirement /tmp/requirements.txt; \
       fi

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin app \
    && mkdir -p \
      /workspace/backend-python/runtime/assessment-data \
      /workspace/backend-python/runtime/assessment-assets \
      /workspace/backend-python/static/uploads \
      /workspace/EAP_front_site/src/data \
      /workspace/EAP_front_site/src/lib/assessment \
    && chown -R app:app /workspace

COPY --chown=app:app backend-python/ /workspace/backend-python/
COPY --chown=app:app EAP_front_site/src/data/ /workspace/EAP_front_site/src/data/
COPY --chown=app:app EAP_front_site/src/lib/assessment/scale-guidance.ts \
  /workspace/EAP_front_site/src/lib/assessment/scale-guidance.ts

USER app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers"]
