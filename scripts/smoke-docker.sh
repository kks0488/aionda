#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--" ]]; then
  shift
fi

IMAGE_TAG="${1:-aionda:test}"
REQUEST_PATH="${AIONDA_SMOKE_PATH:-/robots.txt}"
EXPECTED_TEXT="${AIONDA_SMOKE_EXPECT:-Disallow: /api/admin}"
TIMEOUT_SECONDS="${AIONDA_SMOKE_TIMEOUT:-60}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

container_id="$(docker run -d -p 127.0.0.1::3000 \
  -e NEXT_PUBLIC_SITE_URL=http://localhost \
  -e ADMIN_ENABLED=false \
  "$IMAGE_TAG")"

cleanup() {
  docker rm -f "$container_id" >/dev/null 2>&1 || true
}
trap cleanup EXIT

host_port="$(
  docker port "$container_id" 3000/tcp \
    | awk -F: 'NR==1 { print $NF }'
)"

if [[ -z "$host_port" ]]; then
  echo "failed to detect published port for $container_id" >&2
  docker logs "$container_id" || true
  exit 1
fi

tmp_output="$(mktemp)"

for _ in $(seq 1 "$TIMEOUT_SECONDS"); do
  if curl -fsS "http://127.0.0.1:${host_port}${REQUEST_PATH}" >"$tmp_output" 2>/dev/null; then
    if grep -Fq "$EXPECTED_TEXT" "$tmp_output"; then
      echo "docker smoke passed: ${IMAGE_TAG} ${REQUEST_PATH}"
      cat "$tmp_output"
      rm -f "$tmp_output"
      exit 0
    fi

    echo "smoke response missing expected text: $EXPECTED_TEXT" >&2
    cat "$tmp_output" >&2
    rm -f "$tmp_output"
    exit 1
  fi

  sleep 1
done

echo "docker smoke timed out for ${IMAGE_TAG}" >&2
docker logs "$container_id" || true
rm -f "$tmp_output"
exit 1
