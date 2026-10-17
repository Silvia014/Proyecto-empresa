#!/bin/sh
set -eu

npm run start -- --hostname 0.0.0.0 --port 3002 &
NEXT_PID=$!

nginx -g 'daemon off;' &
NGINX_PID=$!

cleanup() {
    kill "$NEXT_PID" "$NGINX_PID" 2>/dev/null || true
    wait "$NEXT_PID" 2>/dev/null || true
    wait "$NGINX_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

while kill -0 "$NEXT_PID" 2>/dev/null &&
      kill -0 "$NGINX_PID" 2>/dev/null; do
    sleep 1
done

cleanup
exit 1
