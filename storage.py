import sqlite3
import os
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DB_PATH", "/app/data/prices.db")


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS price_history (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                origin        TEXT NOT NULL,
                destination   TEXT NOT NULL,
                trip_type     TEXT NOT NULL,
                outbound_date TEXT,
                return_date   TEXT,
                price         REAL NOT NULL,
                currency      TEXT NOT NULL,
                airline       TEXT,
                booking_url   TEXT,
                checked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Migration: add booking_url to existing DBs that don't have it yet
        try:
            conn.execute("ALTER TABLE price_history ADD COLUMN booking_url TEXT")
        except Exception:
            pass  # column already exists
        conn.commit()
    logger.info(f"Database ready at {DB_PATH}")


def save_price(*, origin, destination, trip_type, price, currency,
               airline=None, outbound_date=None, return_date=None, booking_url=None):
    with _conn() as conn:
        conn.execute("""
            INSERT INTO price_history
              (origin, destination, trip_type, outbound_date, return_date,
               price, currency, airline, booking_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (origin, destination, trip_type, outbound_date, return_date,
              price, currency, airline, booking_url))
        conn.commit()


def get_last_price(origin: str, destination: str, trip_type: str) -> float | None:
    """Returns the most recent recorded price for this route (before today's save)."""
    with _conn() as conn:
        row = conn.execute("""
            SELECT price FROM price_history
            WHERE origin = ? AND destination = ? AND trip_type = ?
            ORDER BY checked_at DESC
            LIMIT 1
        """, (origin, destination, trip_type)).fetchone()
    return row[0] if row else None


def get_price_history(origin: str, destination: str, trip_type: str, limit: int = 30):
    with _conn() as conn:
        rows = conn.execute("""
            SELECT price, currency, airline, outbound_date, booking_url, checked_at
            FROM price_history
            WHERE origin = ? AND destination = ? AND trip_type = ?
            ORDER BY checked_at DESC
            LIMIT ?
        """, (origin, destination, trip_type, limit)).fetchall()
    return rows


def _conn():
    return sqlite3.connect(DB_PATH)
