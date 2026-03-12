import os
import math
import yaml
import sqlite3
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="FlightBuddy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_PATH = os.getenv("CONFIG_PATH", "/app/config.yaml")
DB_PATH = os.getenv("DB_PATH", "/app/data/prices.db")


def load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def save_config(config: dict):
    """Write config directly to the bind-mounted file.
    os.replace (rename) across bind mount boundaries raises EBUSY,
    so we write in-place instead."""
    with open(CONFIG_PATH, "w") as f:
        yaml.safe_dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_price_rows(origin: str, destination: str, trip_type: str, limit: int = 90):
    try:
        with db_conn() as conn:
            rows = conn.execute("""
                SELECT price, currency, airline, outbound_date, booking_url, checked_at
                FROM price_history
                WHERE origin = ? AND destination = ? AND trip_type = ?
                ORDER BY checked_at DESC
                LIMIT ?
            """, (origin, destination, trip_type, limit)).fetchall()
        return rows
    except Exception:
        return []


def calc_smart_threshold(prices: list) -> Optional[float]:
    if len(prices) < 3:
        return None
    avg = sum(prices) / len(prices)
    variance = sum((p - avg) ** 2 for p in prices) / len(prices)
    std_dev = math.sqrt(variance)
    min_price = min(prices)
    candidate = avg - std_dev
    return round(max(candidate, min_price * 1.01), 2)


@app.get("/api/dashboard")
def get_dashboard():
    config = load_config()
    origin = config["origin"]
    result_trips = []

    for trip in config.get("trips", []):
        destination = trip["destination"]
        trip_type = trip.get("trip_type", "round_trip")

        rows = get_price_rows(origin, destination, trip_type)

        latest = None
        prev_price = None
        stats = None
        smart_threshold = None

        if rows:
            latest = {
                "price": rows[0]["price"],
                "currency": rows[0]["currency"],
                "airline": rows[0]["airline"],
                "outbound_date": rows[0]["outbound_date"],
                "booking_url": rows[0]["booking_url"],
                "checked_at": rows[0]["checked_at"],
            }
            if len(rows) >= 2:
                prev_price = rows[1]["price"]

            prices = [r["price"] for r in rows]
            avg = sum(prices) / len(prices)
            min_p = min(prices)
            max_p = max(prices)
            variance = sum((p - avg) ** 2 for p in prices) / len(prices)
            std_dev = math.sqrt(variance)
            stats = {
                "avg": round(avg, 2),
                "min": round(min_p, 2),
                "max": round(max_p, 2),
                "std_dev": round(std_dev, 2),
                "count": len(prices),
            }
            smart_threshold = calc_smart_threshold(prices)

        result_trips.append({
            **trip,
            "latest": latest,
            "prev_price": prev_price,
            "stats": stats,
            "smart_threshold": smart_threshold,
        })

    return {"origin": origin, "trips": result_trips}


@app.get("/api/prices/{origin}/{dest}")
def get_prices(origin: str, dest: str, trip_type: str = "round_trip"):
    rows = get_price_rows(origin, dest, trip_type)
    if not rows:
        return {"prices": [], "avg": None, "threshold": None}

    prices_data = [
        {
            "price": r["price"],
            "currency": r["currency"],
            "airline": r["airline"],
            "outbound_date": r["outbound_date"],
            "booking_url": r["booking_url"],
            "checked_at": r["checked_at"],
        }
        for r in reversed(rows)  # chronological for chart
    ]

    prices = [r["price"] for r in rows]
    avg = round(sum(prices) / len(prices), 2)
    smart_threshold = calc_smart_threshold(prices)

    return {"prices": prices_data, "avg": avg, "threshold": smart_threshold}


class TripCreate(BaseModel):
    name: str
    destination: str
    trip_type: str = "round_trip"
    duration_days: int = 7
    date_range: Optional[dict] = None
    specific_dates: Optional[list] = None
    stops: Optional[int] = None
    max_price: Optional[float] = None
    currency: str = "USD"


def _trip_to_dict(trip: TripCreate) -> dict:
    return {k: v for k, v in trip.model_dump().items() if v is not None}


@app.post("/api/trips", status_code=201)
def create_trip(trip: TripCreate):
    config = load_config()
    trips = config.get("trips", [])

    if any(t["name"] == trip.name for t in trips):
        raise HTTPException(400, f"El viaje '{trip.name}' ya existe")

    new_trip = _trip_to_dict(trip)
    trips.append(new_trip)
    config["trips"] = trips
    save_config(config)
    logger.info(f"Trip created: {trip.name}")
    return new_trip


@app.put("/api/trips/{name}")
def update_trip(name: str, trip: TripCreate):
    config = load_config()
    trips = config.get("trips", [])

    idx = next((i for i, t in enumerate(trips) if t["name"] == name), None)
    if idx is None:
        raise HTTPException(404, f"Viaje '{name}' no encontrado")

    # If renaming, ensure new name doesn't collide with another trip
    if trip.name != name and any(t["name"] == trip.name for t in trips):
        raise HTTPException(400, f"El viaje '{trip.name}' ya existe")

    updated = _trip_to_dict(trip)
    trips[idx] = updated
    config["trips"] = trips
    save_config(config)
    logger.info(f"Trip updated: {name} → {trip.name}")
    return updated


@app.delete("/api/trips/{name}", status_code=204)
def delete_trip(name: str):
    config = load_config()
    trips = config.get("trips", [])
    new_trips = [t for t in trips if t["name"] != name]

    if len(new_trips) == len(trips):
        raise HTTPException(404, f"Viaje '{name}' no encontrado")

    config["trips"] = new_trips
    save_config(config)
    logger.info(f"Trip deleted: {name}")


class ThresholdUpdate(BaseModel):
    max_price: float


@app.put("/api/trips/{name}/threshold")
def update_threshold(name: str, body: ThresholdUpdate):
    config = load_config()
    trips = config.get("trips", [])

    for trip in trips:
        if trip["name"] == name:
            trip["max_price"] = body.max_price
            save_config(config)
            logger.info(f"Threshold updated for {name}: {body.max_price}")
            return trip

    raise HTTPException(404, f"Viaje '{name}' no encontrado")


# Serve built React app in production (only if dist exists)
DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "dist")
if os.path.isdir(DIST_DIR):
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="static")
    logger.info(f"Serving React app from {DIST_DIR}")
