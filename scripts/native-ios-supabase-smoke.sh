#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

read_env_value() {
  local key="$1"
  local file

  for file in "${ROOT_DIR}/.env" "${ROOT_DIR}/.env.submit"; do
    [[ -f "${file}" ]] || continue

    local line
    line="$(grep -E "^${key}=" "${file}" | tail -n 1 || true)"
    [[ -n "${line}" ]] || continue

    local value="${line#*=}"
    value="${value%$'\r'}"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    printf '%s' "${value}"
    return 0
  done

  return 1
}

SUPABASE_URL_VALUE="$(read_env_value EXPO_PUBLIC_SUPABASE_URL || true)"
SUPABASE_KEY_VALUE="$(read_env_value EXPO_PUBLIC_SUPABASE_KEY || true)"

if [[ -z "${SUPABASE_URL_VALUE}" || -z "${SUPABASE_KEY_VALUE}" ]]; then
  echo "Missing Supabase env values; expected EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY." >&2
  exit 1
fi

LATITUDE="${1:-37.7879}"
LONGITUDE="${2:--122.4075}"
RADIUS_METERS="${3:-4000}"
MIN_CONFIDENCE="${4:-0.35}"
VERIFIED_ONLY="${5:-true}"

BODY_FILE="$(mktemp)"
cleanup() {
  rm -f "${BODY_FILE}"
}
trap cleanup EXIT

HTTP_STATUS="$(
  curl -sS \
    -o "${BODY_FILE}" \
    -w "%{http_code}" \
    -X POST "${SUPABASE_URL_VALUE%/}/rest/v1/rpc/get_nearby_radars_v2" \
    -H "apikey: ${SUPABASE_KEY_VALUE}" \
    -H "Authorization: Bearer ${SUPABASE_KEY_VALUE}" \
    -H "Content-Type: application/json" \
    -d "{\"lat\":${LATITUDE},\"long\":${LONGITUDE},\"radius_meters\":${RADIUS_METERS},\"min_confidence\":${MIN_CONFIDENCE},\"verified_only\":${VERIFIED_ONLY}}"
)"

node - "${BODY_FILE}" "${HTTP_STATUS}" <<'NODE'
const fs = require('fs');

const [bodyPath, statusRaw] = process.argv.slice(2);
const status = Number(statusRaw);
const rawBody = fs.readFileSync(bodyPath, 'utf8');

let body;
try {
  body = rawBody ? JSON.parse(rawBody) : null;
} catch (error) {
  console.error(`Supabase smoke returned non-JSON body with HTTP ${status}.`);
  process.exit(1);
}

if (status < 200 || status > 299) {
  console.error(`Supabase smoke failed with HTTP ${status}.`);
  if (body && typeof body === 'object') {
    console.error(JSON.stringify({
      code: body.code,
      message: body.message,
      details: body.details
    }, null, 2));
  }
  process.exit(1);
}

if (!Array.isArray(body)) {
  console.error('Supabase smoke expected an array response.');
  console.error(JSON.stringify({ status, responseType: typeof body }, null, 2));
  process.exit(1);
}

const summarize = (key) => body.reduce((acc, row) => {
  const value = row && row[key] ? String(row[key]) : 'unknown';
  acc[value] = (acc[value] || 0) + 1;
  return acc;
}, {});

const sample = body.slice(0, 8).map((row) => ({
  type: row.type || null,
  source: row.source || row.metadata?.source_key || null,
  verified: row.verified ?? null,
  confidence: row.confidence ?? null,
  dist_meters: Number.isFinite(row.dist_meters) ? Math.round(row.dist_meters) : null
}));

console.log(JSON.stringify({
  status,
  count: body.length,
  typeCounts: summarize('type'),
  sourceCounts: summarize('source'),
  sample
}, null, 2));
NODE
