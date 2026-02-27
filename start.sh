#!/bin/sh

# Start Express backend on localhost:3001 (internal only, not exposed to Railway)
cd /app/backend
BACKEND_PORT=3001 npx tsx src/index.ts &

# Give backend a moment to initialize
sleep 2

# Start SvelteKit frontend as main process (listens on 0.0.0.0:$PORT)
# ORIGIN needed for CSRF protection, BODY_SIZE_LIMIT for large page uploads
cd /app/frontend
exec env \
  ORIGIN="${ORIGIN:-https://env-ll.com}" \
  BODY_SIZE_LIMIT=52428800 \
  BACKEND_URL=http://127.0.0.1:3001 \
  node build/index.js
