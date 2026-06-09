#!/usr/bin/env bash
# Local MCP server smoke test for Mission Control.
# Usage:
#   npm run test:mcp
#   npm run test:mcp -- --port 3001
#   npm run test:mcp -- --save-tasks
#   npm run test:mcp -- --base-url http://localhost:3001

set -euo pipefail

BASE_URL="${MCP_BASE_URL:-http://localhost:3000}"
SAVE_TASKS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      BASE_URL="http://localhost:${2:?missing port}"
      shift 2
      ;;
    --base-url)
      BASE_URL="${2:?missing base url}"
      shift 2
      ;;
    --save-tasks)
      SAVE_TASKS=true
      shift
      ;;
    -h | --help)
      echo "Usage: $0 [--port N] [--base-url URL] [--save-tasks]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

MCP_URL="${BASE_URL%/}/api/mcp"
MESSAGES_URL="${BASE_URL%/}/api/mcp/messages"

PASS=0
FAIL=0
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*" >&2; }
info() { printf '→ %s\n' "$*"; }

pass() {
  PASS=$((PASS + 1))
  green "  ✓ $1"
}

fail() {
  FAIL=$((FAIL + 1))
  red "  ✗ $1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "Missing required command: $1"
    exit 1
  fi
}

json_field() {
  local file="$1"
  local pattern="$2"
  if grep -q "$pattern" "$file" 2>/dev/null; then
    return 0
  fi
  return 1
}

require_cmd curl

echo ""
echo "Mission Control MCP local test"
echo "Base URL: $BASE_URL"
echo ""

info "1) CORS preflight (OPTIONS /api/mcp)"
CORS_HEADERS="$TMP_DIR/cors.headers"
CORS_STATUS="$(curl -s -o /dev/null -w '%{http_code}' -D "$CORS_HEADERS" -X OPTIONS "$MCP_URL" \
  -H "Origin: https://cloud.google.com" \
  -H "Access-Control-Request-Method: POST")"

if [[ "$CORS_STATUS" == "204" ]] && grep -qi 'access-control-allow-origin' "$CORS_HEADERS"; then
  pass "CORS preflight returned 204 with allow-origin header"
else
  fail "CORS preflight failed (status $CORS_STATUS)"
fi

info "2) Legacy SSE (GET /api/mcp)"
SSE_OUT="$TMP_DIR/sse.txt"
curl -s -N --max-time 3 "$MCP_URL" >"$SSE_OUT" 2>/dev/null || true

if grep -q '^event: endpoint$' "$SSE_OUT" && grep -q '^data: /api/mcp/messages?sessionId=' "$SSE_OUT"; then
  pass "Legacy SSE stream returned endpoint event"
else
  fail "Legacy SSE stream missing endpoint event"
  sed 's/^/    /' "$SSE_OUT" >&2 || true
fi

LEGACY_SESSION="$(grep '^data:' "$SSE_OUT" | head -1 | sed 's/^data: //' | sed 's/.*sessionId=//' | tr -d '\r')"
if [[ -n "$LEGACY_SESSION" ]]; then
  pass "Extracted legacy session ID"
else
  fail "Could not extract legacy session ID"
fi

info "3) Legacy messages round-trip (POST /api/mcp/messages)"
LEGACY_STREAM="$TMP_DIR/legacy-stream.txt"
curl -s -N "$MCP_URL" >"$LEGACY_STREAM" 2>/dev/null &
LEGACY_CURL_PID=$!
sleep 1

LEGACY_SESSION="$(grep '^data:' "$LEGACY_STREAM" | head -1 | sed 's/^data: //' | sed 's/.*sessionId=//' | tr -d '\r')"
LEGACY_POST_STATUS="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${MESSAGES_URL}?sessionId=${LEGACY_SESSION}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')"

sleep 1
kill "$LEGACY_CURL_PID" 2>/dev/null || true
wait "$LEGACY_CURL_PID" 2>/dev/null || true

if [[ "$LEGACY_POST_STATUS" == "202" ]]; then
  pass "Legacy messages endpoint accepted tools/list (202)"
else
  fail "Legacy messages endpoint returned $LEGACY_POST_STATUS (expected 202)"
fi

if json_field "$LEGACY_STREAM" 'save_tasks'; then
  pass "Legacy SSE stream received tools/list response with save_tasks"
else
  fail "Legacy SSE stream did not include save_tasks in response"
fi

info "4) Streamable HTTP initialize (POST /api/mcp)"
INIT_HEADERS="$TMP_DIR/init.headers"
INIT_BODY="$TMP_DIR/init.body"
INIT_STATUS="$(curl -s -o "$INIT_BODY" -w '%{http_code}' -D "$INIT_HEADERS" -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-mcp-script","version":"1.0.0"}}}')"

STREAM_SESSION="$(grep -i '^mcp-session-id:' "$INIT_HEADERS" | awk '{print $2}' | tr -d '\r')"

if [[ "$INIT_STATUS" == "200" ]] && [[ -n "$STREAM_SESSION" ]]; then
  pass "Streamable HTTP initialize returned 200 with mcp-session-id"
else
  fail "Streamable HTTP initialize failed (status $INIT_STATUS, session=${STREAM_SESSION:-none})"
  sed 's/^/    /' "$INIT_BODY" >&2 || true
fi

info "5) Streamable HTTP tools/list"
curl -s -o /dev/null -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $STREAM_SESSION" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' || true

TOOLS_BODY="$TMP_DIR/tools.body"
TOOLS_STATUS="$(curl -s -o "$TOOLS_BODY" -w '%{http_code}' -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $STREAM_SESSION" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')"

if [[ "$TOOLS_STATUS" == "200" ]] && json_field "$TOOLS_BODY" 'save_tasks'; then
  pass "Streamable HTTP tools/list includes save_tasks"
else
  fail "Streamable HTTP tools/list failed (status $TOOLS_STATUS)"
  sed 's/^/    /' "$TOOLS_BODY" >&2 || true
fi

if [[ "$SAVE_TASKS" == "true" ]]; then
  info "6) save_tasks tool call (requires MONGODB_URI on the dev server)"
  SAVE_BODY="$TMP_DIR/save.body"

  SAVE_STATUS="$(curl -s -o "$SAVE_BODY" -w '%{http_code}' -X POST "${MESSAGES_URL}?sessionId=${LEGACY_SESSION}" \
    -H "Content-Type: application/json" \
    -d '{
      "jsonrpc": "2.0",
      "id": 99,
      "method": "tools/call",
      "params": {
        "name": "save_tasks",
        "arguments": {
          "tasks": [
            {
              "title": "MCP script test task",
              "pillar": "Admin",
              "bucket": "today",
              "is_new": true
            }
          ]
        }
      }
    }')"

  if [[ "$SAVE_STATUS" == "202" ]]; then
    pass "save_tasks accepted via legacy messages endpoint (202)"
    echo "    Check MongoDB Atlas → tasks collection for a new document."
  else
    fail "save_tasks call failed (status $SAVE_STATUS)"
    sed 's/^/    /' "$SAVE_BODY" >&2 || true
  fi
else
  info "6) save_tasks skipped (pass --save-tasks to test MongoDB insert)"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  red "Some checks failed. Is the dev server running?"
  echo "  npm run dev"
  echo "  npm run test:mcp -- --port 3001"
  exit 1
fi

green "All MCP checks passed."
