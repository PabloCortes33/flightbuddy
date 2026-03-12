import logging
import yaml
from datetime import datetime
from dotenv import load_dotenv
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from scraper import search_flights
from storage import init_db, save_price, get_last_price
from notifier import send_alert, build_drop_message, build_threshold_message, build_first_check_message

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

CONFIG_PATH = "/app/config.yaml"


def load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def run_check():
    logger.info("=== Iniciando chequeo de precios ===")
    config = load_config()
    origin = config["origin"]
    notify_cfg = config.get("notify", {})
    only_on_drop = notify_cfg.get("only_on_drop", True)
    alert_on_threshold = notify_cfg.get("alert_on_threshold", True)

    for trip in config.get("trips", []):
        trip_origin = trip.get("origin", origin)  # per-trip origin or global fallback
        name = trip.get("name", f"{trip_origin}→{trip['destination']}")
        logger.info(f"Procesando: {name}")

        result = search_flights(trip_origin, trip)
        if not result:
            continue

        destination = trip["destination"]
        trip_type = trip.get("trip_type", "round_trip")
        current_price = result["price"]
        currency = result["currency"]
        airline = result["airline"]
        outbound_date = result["outbound_date"]
        return_date = result["return_date"]

        last_price = get_last_price(trip_origin, destination, trip_type)

        # Always save to history
        save_price(
            origin=trip_origin,
            destination=destination,
            trip_type=trip_type,
            price=current_price,
            currency=currency,
            airline=airline,
            outbound_date=outbound_date,
            return_date=return_date,
            booking_url=result.get("booking_url"),
        )

        # --- Decide notification ---
        if last_price is None:
            logger.info(f"{name}: primer registro → {current_price} {currency}")
            if not only_on_drop:
                msg = build_first_check_message(name, current_price, currency, airline, outbound_date, return_date)
                send_alert(msg)

        elif current_price < last_price:
            logger.info(f"{name}: precio BAJO {last_price} → {current_price} {currency}")
            msg = build_drop_message(name, last_price, current_price, currency, airline, outbound_date, return_date)
            send_alert(msg)

        else:
            logger.info(f"{name}: sin cambio ({current_price} {currency})")

        # --- Threshold alert (independent of price drop) ---
        if alert_on_threshold and trip.get("max_price"):
            if current_price <= trip["max_price"]:
                logger.info(f"{name}: precio {current_price} bajo umbral {trip['max_price']}")
                # Only send threshold alert if we didn't already send a drop alert
                if last_price is None or current_price >= last_price:
                    msg = build_threshold_message(name, current_price, trip["max_price"], currency, airline, outbound_date, return_date)
                    send_alert(msg)

    logger.info("=== Chequeo completado ===")


if __name__ == "__main__":
    logger.info("FlightBuddy arrancando...")
    init_db()

    # Run immediately on startup
    run_check()

    # Schedule daily
    config = load_config()
    run_hour = config.get("notify", {}).get("run_hour", 8)

    scheduler = BlockingScheduler(timezone="America/Santiago")
    scheduler.add_job(
        run_check,
        CronTrigger(hour=run_hour, minute=0),
        id="daily_check",
        name="Chequeo diario de vuelos",
    )

    logger.info(f"Scheduler activo — corre diariamente a las {run_hour:02d}:00 (hora Santiago)")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("FlightBuddy detenido.")
