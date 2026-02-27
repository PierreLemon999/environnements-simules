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
ARG PUBLIC_GOOGLE_CLIENT_ID
RUN cd frontend && PUBLIC_API_BASE_URL=/api PUBLIC_GOOGLE_CLIENT_ID=${PUBLIC_GOOGLE_CLIENT_ID} npm run build

# Seed database with initial data
RUN cd backend && npx tsx src/db/seed.ts

ENV NODE_ENV=production
ENV PROTOCOL_HEADER=x-forwarded-proto
ENV HOST_HEADER=host
ENV BODY_SIZE_LIMIT=52428800
WORKDIR /app/backend

CMD ["npx", "tsx", "src/production-server.ts"]
