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

# Start script
COPY start.sh ./start.sh
RUN chmod +x start.sh

ENV NODE_ENV=production

CMD ["./start.sh"]
