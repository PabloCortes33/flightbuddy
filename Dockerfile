# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py .

# Copy built React app from stage 1
COPY --from=frontend-builder /frontend/dist ./web/dist

# /app/config.yaml y /app/data/ se montan como volúmenes en docker-compose
EXPOSE 8000

CMD ["python", "main.py"]
