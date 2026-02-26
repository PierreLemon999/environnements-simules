FROM node:22-slim

WORKDIR /app

# Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci
COPY backend/ ./backend/

# Frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Seed database with initial data
RUN cd backend && npx tsx src/db/seed.ts

# Start script: backend on 3001, frontend on PORT (Railway assigns PORT)
# Frontend proxies /api to backend internally
COPY <<'EOF' /app/start.sh
#!/bin/sh
set -e

# Backend API on port 3001
cd /app/backend
node --import tsx src/index.ts &

# Frontend on $PORT (Railway expects this)
cd /app/frontend
PORT=${PORT:-3000} ORIGIN=${ORIGIN:-https://env-ll.com} BODY_SIZE_LIMIT=52428800 node build/index.js &

wait
EOF
RUN chmod +x /app/start.sh

ENV NODE_ENV=production
EXPOSE 3000

CMD ["/app/start.sh"]
