LOCAL  = docker compose -f docker-compose.yml -f docker-compose.local.yml
PROD   = docker compose -f docker-compose.yml -f docker-compose.prod.yml

# ── Local ────────────────────────────────────────────────────────────────────
up-local:
	$(LOCAL) up --build

down-local:
	$(LOCAL) down

logs-local:
	$(LOCAL) logs -f

# ── Producción ───────────────────────────────────────────────────────────────
up-prod:
	$(PROD) up -d --build

down-prod:
	$(PROD) down

logs-prod:
	$(PROD) logs -f

# ── Utilidades ───────────────────────────────────────────────────────────────
# Corre el chequeo una sola vez sin esperar el cron (útil para probar)
run-once-local:
	$(LOCAL) run --rm scheduler python -c "from dotenv import load_dotenv; load_dotenv(); from storage import init_db; init_db(); from main import run_check; run_check()"

# Ver historial de precios en la DB
db-local:
	sqlite3 data/prices.db "SELECT origin, destination, trip_type, price, currency, airline, outbound_date, checked_at FROM price_history ORDER BY checked_at DESC LIMIT 20;"

# Instalar dependencias del frontend (ejecutar antes del primer up-local si no hay Docker)
install-frontend:
	cd frontend && npm ci

.PHONY: up-local down-local logs-local up-prod down-prod logs-prod run-once-local db-local install-frontend
