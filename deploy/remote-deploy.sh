#!/usr/bin/env bash
set -euo pipefail

sha="$1"
base=/opt/static-content
release="$base/releases/$sha"
previous="$(readlink -f "$base/current" || true)"

activate() {
  ln -sfn "$1" "$base/current.next"
  mv -T "$base/current.next" "$base/current"
  sudo /usr/bin/systemctl restart static-content.service
}

is_healthy() {
  for _ in $(seq 1 20); do
    if curl --fail --silent http://127.0.0.1:3200/healthz >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

mkdir -p "$release"
tar -xzf "$base/releases/$sha.tgz" -C "$release"
rm "$base/releases/$sha.tgz"
echo "APP_VERSION=$sha" > "$release/release.env"

activate "$release"

if ! is_healthy; then
  echo "release $sha is unhealthy" >&2
  if [ -n "$previous" ] && [ -d "$previous" ]; then
    activate "$previous"
    echo "rolled back to $previous" >&2
  fi
  exit 1
fi

ls -1dt "$base"/releases/*/ | tail -n +6 | xargs -r rm -rf
echo "release $sha is live"
