#!/usr/bin/env bash
# check-gocardless-coverage.sh
#
# Validation spike #1 — confirms the user's Revolut and ABN AMRO institutions
# are present in the GoCardless Bank Account Data catalogue for the
# Netherlands, and prints the per-institution constraints that drive
# our design (transaction_total_days, max_access_valid_for_days, etc.).
#
# Usage:
#   SECRET_ID=...  SECRET_KEY=...  ./check-gocardless-coverage.sh
#   COUNTRY=de SECRET_ID=... SECRET_KEY=... ./check-gocardless-coverage.sh
#
# Requires: bash, curl, python3 stdlib. No jq, no extra deps.

set -euo pipefail

: "${SECRET_ID:?Set SECRET_ID env var (from bankaccountdata.gocardless.com user secrets)}"
: "${SECRET_KEY:?Set SECRET_KEY env var}"

BASE="https://bankaccountdata.gocardless.com/api/v2"
COUNTRY="${COUNTRY:-nl}"

echo "==> Requesting access token..."
TOKEN_RESPONSE=$(curl -sS -X POST "${BASE}/token/new/" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "{\"secret_id\":\"${SECRET_ID}\",\"secret_key\":\"${SECRET_KEY}\"}")

ACCESS_TOKEN=$(printf '%s' "$TOKEN_RESPONSE" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access"])')

if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "ERROR: could not obtain access token. Response was:"
  printf '%s\n' "$TOKEN_RESPONSE"
  exit 1
fi
echo "    token acquired (truncated): ${ACCESS_TOKEN:0:24}..."

echo "==> Listing institutions for country=${COUNTRY}..."
INSTITUTIONS=$(curl -sS -X GET "${BASE}/institutions/?country=${COUNTRY}" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

print_filtered() {
  local label="$1"
  local pattern="$2"
  echo
  echo "==================== ${label} ===================="
  printf '%s' "$INSTITUTIONS" | INSTITUTION_PATTERN="$pattern" python3 - <<'PY'
import json, os, sys, re
data = json.loads(sys.stdin.read())
pattern = re.compile(os.environ["INSTITUTION_PATTERN"], re.IGNORECASE)
matches = [
    i for i in data
    if pattern.search(i.get("id", "")) or pattern.search(i.get("name", ""))
]
if not matches:
    print("  (no matches)")
    sys.exit(0)
for inst in matches:
    print(f"  id                                  : {inst.get('id')}")
    print(f"  name                                : {inst.get('name')}")
    print(f"  bic                                 : {inst.get('bic')}")
    print(f"  transaction_total_days              : {inst.get('transaction_total_days')}")
    print(f"  max_access_valid_for_days           : {inst.get('max_access_valid_for_days')}")
    print(f"  max_access_valid_for_days_reconfirm : {inst.get('max_access_valid_for_days_reconfirmation')}")
    print(f"  countries                           : {','.join(inst.get('countries', []))}")
    print(f"  supported_payments                  : {inst.get('supported_payments')}")
    print(f"  supported_features                  : {inst.get('supported_features')}")
    print(f"  logo                                : {inst.get('logo')}")
    print("  ---")
PY
}

print_filtered "Revolut entries (country=${COUNTRY})"  "revolut"
print_filtered "ABN AMRO entries (country=${COUNTRY})" "abn[ _-]?amro"

echo
echo "==> Done."
echo "    Look for Revolut Bank UAB (BIC REVOLT21) — the EU passport entity."
echo "    If only Revolut Ltd (BIC REVOGB21) appears, you'll be limited to the UK entity."
