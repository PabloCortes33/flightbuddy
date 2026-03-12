import os
import logging
import urllib.parse
import requests
import yaml

logger = logging.getLogger(__name__)

CONFIG_PATH = os.getenv("CONFIG_PATH", "/app/config.yaml")


def _load_recipients() -> list:
    """
    Load recipients from config.yaml notify.recipients.
    Falls back to CALLMEBOT_APIKEY / WHATSAPP_PHONE env vars for backwards compatibility.
    """
    try:
        with open(CONFIG_PATH) as f:
            config = yaml.safe_load(f)
        recipients = config.get("notify", {}).get("recipients", [])
        if recipients:
            return recipients
    except Exception:
        pass

    # Env var fallback (original behaviour)
    phone = os.getenv("WHATSAPP_PHONE")
    apikey = os.getenv("CALLMEBOT_APIKEY")
    if phone and apikey:
        return [{"phone": phone, "apikey": apikey}]

    return []


def _send_to(phone: str, apikey: str, message: str):
    encoded = urllib.parse.quote(message)
    url = (
        f"https://api.callmebot.com/whatsapp.php"
        f"?phone={phone}&text={encoded}&apikey={apikey}"
    )
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            logger.info(f"WhatsApp notification sent to {phone}")
        else:
            logger.error(f"CallMeBot error {resp.status_code} for {phone}: {resp.text}")
    except requests.RequestException as e:
        logger.error(f"Failed to send WhatsApp notification to {phone}: {e}")


def send_alert(message: str):
    """Send WhatsApp message to all configured recipients."""
    recipients = _load_recipients()
    if not recipients:
        logger.warning(
            "No recipients configured — set notify.recipients in config.yaml "
            "or CALLMEBOT_APIKEY/WHATSAPP_PHONE env vars"
        )
        return
    for r in recipients:
        _send_to(r["phone"], r["apikey"], message)


def build_drop_message(trip_name, old_price, new_price, currency, airline, outbound_date, return_date):
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


def build_threshold_message(trip_name, price, max_price, currency, airline, outbound_date, return_date):
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


def build_first_check_message(trip_name, price, currency, airline, outbound_date, return_date):
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
