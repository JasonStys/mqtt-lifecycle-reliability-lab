#!/usr/bin/env bash
# File: Local Mosquitto launcher.
# Purpose: Validate prerequisites and start the loopback-only optional broker profile.
# Variables: repository_root resolves this script's parent; compose_file targets compose.yaml.
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${repository_root}/compose.yaml"

if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is required for the optional Mosquitto profile.\n' >&2
  exit 1
fi

docker compose -f "${compose_file}" up -d --wait
printf 'MQTT broker ready at mqtt://127.0.0.1:1883\n'
