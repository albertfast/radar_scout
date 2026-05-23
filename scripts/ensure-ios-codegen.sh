#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEGEN_DIR="${ROOT_DIR}/ios/build/generated/ios"
PROVIDER_HEADER="${CODEGEN_DIR}/RCTAppDependencyProvider.h"
PROVIDER_IMPL="${CODEGEN_DIR}/RCTAppDependencyProvider.mm"
CODEGEN_SCRIPT="${ROOT_DIR}/node_modules/react-native/scripts/generate-codegen-artifacts.js"
PROVIDER_PATCH_SCRIPT="${ROOT_DIR}/scripts/patch-ios-third-party-components-provider.js"

info() { echo "[INFO] $*"; }
ok() { echo "[OK] $*"; }

if [[ -f "${PROVIDER_HEADER}" && -f "${PROVIDER_IMPL}" ]]; then
  node "${PROVIDER_PATCH_SCRIPT}"
  ok "React Native iOS codegen output is present."
  exit 0
fi

if [[ ! -f "${CODEGEN_SCRIPT}" ]]; then
  echo "[ERROR] React Native codegen script not found. Run your package manager install first." >&2
  exit 1
fi

info "Generating React Native iOS codegen artifacts..."
node "${CODEGEN_SCRIPT}" -p "${ROOT_DIR}" -o "${ROOT_DIR}/ios" -t ios

if [[ ! -f "${PROVIDER_HEADER}" || ! -f "${PROVIDER_IMPL}" ]]; then
  echo "[ERROR] React Native iOS codegen did not create RCTAppDependencyProvider.{h,mm}." >&2
  exit 1
fi

node "${PROVIDER_PATCH_SCRIPT}"
ok "Generated React Native iOS codegen output."
