import os
import logging
import urllib.parse
import requests

logger = logging.getLogger(__name__)

CALLMEBOT_APIKEY = os.getenv("CALLMEBOT_APIKEY")
WHATSAPP_PHONE = os.getenv("WHATSAPP_PHONE")


def send_alert(message: str):
    """Send WhatsApp message via CallMeBot."""
    if not CALLMEBOT_APIKEY or not WHATSAPP_PHONE:
        logger.error("Missing CALLMEBOT_APIKEY or WHATSAPP_PHONE in environment")
        return

    encoded = urllib.parse.quote(message)
    url = (
        f"https://api.callmebot.com/whatsapp.php"
        f"?phone={WHATSAPP_PHONE}&text={encoded}&apikey={CALLMEBOT_APIKEY}"
    )

    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            logger.info("WhatsApp notification sent")
        else:
            logger.error(f"CallMeBot error {resp.status_code}: {resp.text}")
    except requests.RequestException as e:
        logger.error(f"Failed to send WhatsApp notification: {e}")


def build_drop_message(trip_name: str, old_price: float, new_price: float,
                       currency: str, airline: str, outbound_date: str,
                       return_date: str | None) -> str:
    drop = old_price - new_price
    drop_pct = (drop / old_price) * 100
    lines = [
        f"*FlightBuddy* - Precio baja!",
        f"",
        f"*{trip_name}*",
        f"Antes: {old_price:.0f} {currency}",
        f"Ahora: {new_price:.0f} {currency}",
        f"Baja: -{drop:.0f} {currency} ({drop_pct:.1f}%)",
        f"Aerolinea: {airline}",
    ]
    if outbound_date:
        lines.append(f"Salida: {outbound_date}")
    if return_date:
        lines.append(f"Regreso: {return_date}")
    return "\n".join(lines)


def build_threshold_message(trip_name: str, price: float, max_price: float,
                             currency: str, airline: str, outbound_date: str,
                             return_date: str | None) -> str:
    lines = [
        f"*FlightBuddy* - Bajo tu umbral!",
        f"",
        f"*{trip_name}*",
        f"Precio: {price:.0f} {currency} (umbral: {max_price:.0f})",
        f"Aerolinea: {airline}",
    ]
    if outbound_date:
        lines.append(f"Salida: {outbound_date}")
    if return_date:
        lines.append(f"Regreso: {return_date}")
    return "\n".join(lines)


def build_first_check_message(trip_name: str, price: float, currency: str,
                               airline: str, outbound_date: str,
                               return_date: str | None) -> str:
    lines = [
        f"*FlightBuddy* - Primer registro",
        f"",
        f"*{trip_name}*",
        f"Precio inicial: {price:.0f} {currency}",
        f"Aerolinea: {airline}",
    ]
    if outbound_date:
        lines.append(f"Salida: {outbound_date}")
    if return_date:
        lines.append(f"Regreso: {return_date}")
    return "\n".join(lines)
