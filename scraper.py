import os
import logging
from datetime import datetime, timedelta
from serpapi import GoogleSearch

logger = logging.getLogger(__name__)

SERPAPI_KEY = os.getenv("SERPAPI_KEY")


def search_flights(origin: str, trip: dict) -> dict | None:
    """
    Search Google Flights via SerpAPI.
    Returns a dict with price, currency, airline, outbound_date, return_date
    or None if no results.
    """
    destination = trip["destination"]
    trip_type = trip.get("trip_type", "round_trip")
    duration = trip.get("duration_days", 7)
    currency = trip.get("currency", "USD")

    outbound_date, return_date = _resolve_dates(trip)
    if not outbound_date:
        logger.info(f"No active dates for trip to {destination}, skipping")
        return None

    params = {
        "engine": "google_flights",
        "departure_id": origin,
        "arrival_id": destination,
        "outbound_date": outbound_date,
        "currency": currency,
        "hl": "es",
        "gl": "cl",
        "type": "1" if trip_type == "round_trip" else "2",
        "api_key": SERPAPI_KEY,
    }
    if trip_type == "round_trip" and return_date:
        params["return_date"] = return_date

    # stops: 0 = directo, 1 = máx 1 escala, omitido = cualquiera
    stops = trip.get("stops")
    if stops is not None:
        params["stops"] = stops

    logger.info(f"Searching {origin}→{destination} ({trip_type}) | {outbound_date} → {return_date or 'N/A'} | stops={stops if stops is not None else 'any'}")

    try:
        results = GoogleSearch(params).get_dict()
    except Exception as e:
        logger.error(f"SerpAPI request failed: {e}")
        return None

    if "error" in results:
        logger.error(f"SerpAPI error: {results['error']}")
        return None

    best = _parse_best_price(results, outbound_date, return_date, currency)
    if best:
        best["booking_url"] = results.get("search_metadata", {}).get("google_flights_url")
    return best


def _resolve_dates(trip: dict) -> tuple[str | None, str | None]:
    """
    Determine which outbound/return dates to search today.
    Uses a stable reference date within the range so day-over-day
    price comparisons are meaningful.
    """
    today = datetime.now()
    duration = trip.get("duration_days", 7)
    trip_type = trip.get("trip_type", "round_trip")

    # --- specific_dates: use first future pair ---
    if trip.get("specific_dates"):
        today_str = today.strftime("%Y-%m-%d")
        for pair in trip["specific_dates"]:
            if pair["outbound"] >= today_str:
                return pair["outbound"], pair.get("return")
        return None, None  # all dates passed

    # --- date_range: use a stable midpoint as reference ---
    if trip.get("date_range"):
        from_dt = datetime.strptime(trip["date_range"]["from"], "%Y-%m-%d")
        to_dt = datetime.strptime(trip["date_range"]["to"], "%Y-%m-%d")

        if today > to_dt:
            return None, None  # range passed

        # Stable reference: midpoint of range, clamped to future
        mid = from_dt + (to_dt - from_dt) / 2
        candidate = max(mid, today + timedelta(days=14))

        # Ensure there's room for the return flight
        latest_outbound = to_dt - timedelta(days=duration if trip_type == "round_trip" else 0)
        if candidate > latest_outbound:
            candidate = latest_outbound

        if candidate <= today:
            return None, None

        outbound = candidate.strftime("%Y-%m-%d")
        ret = (candidate + timedelta(days=duration)).strftime("%Y-%m-%d") if trip_type == "round_trip" else None
        return outbound, ret

    # --- no dates: search 30 days out ---
    future = today + timedelta(days=30)
    outbound = future.strftime("%Y-%m-%d")
    ret = (future + timedelta(days=trip.get("duration_days", 7))).strftime("%Y-%m-%d") if trip.get("trip_type", "round_trip") == "round_trip" else None
    return outbound, ret


def _parse_best_price(results: dict, outbound_date: str, return_date: str | None, currency: str) -> dict | None:
    best_price = float("inf")
    best = None

    for category in ("best_flights", "other_flights"):
        for flight in results.get(category, []):
            price = flight.get("price")
            if price and price < best_price:
                best_price = price
                airline = "Desconocida"
                legs = flight.get("flights", [])
                if legs:
                    airline = legs[0].get("airline", "Desconocida")
                best = {
                    "price": price,
                    "currency": currency,
                    "airline": airline,
                    "outbound_date": outbound_date,
                    "return_date": return_date,
                    "total_duration_min": flight.get("total_duration"),
                }

    if not best:
        logger.warning("No flights found in SerpAPI response")
    return best
