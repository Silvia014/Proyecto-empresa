from __future__ import annotations

from typing import Literal, Optional
from pathlib import Path
import json
import math
import os
import re
import time
import unicodedata
from decimal import Decimal, ROUND_HALF_UP
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request as UrlRequest, urlopen
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text

from ..database import engine

router = APIRouter(prefix="/api")
CATALOG_PATH = Path(__file__).with_name("catalog.json")
DELIVERY_RADIUS_KM = 5.0
FX_RATE_CACHE_SECONDS = 15 * 60
_FX_RATE_CACHE: dict[tuple[str, str], tuple[float, float]] = {}
BRANCH_ADDRESSES = {
    "Bogotá": ("Callejón del Embudo 5, 110111 Bogotá, Colombia", "CO"),
    "Cali": ("Avenida 9 Norte 10-23, Granada, Cali, Colombia", "CO"),
    "Medellín": ("Carrera 43A 1-50, El Poblado, Medellín, Colombia", "CO"),
    "Miami": ("1200 Brickell Avenue, Miami, FL 33131, USA", "US"),
    "Orlando": ("123 Church Street, Orlando, FL 32801, USA", "US"),
}
BRANCH_COORDINATES = {}


def branch_for_city(city: str):
    normalized_city = "".join(
        character for character in unicodedata.normalize("NFKD", city.casefold())
        if not unicodedata.combining(character)
    ).strip()
    for city, address in BRANCH_ADDRESSES.items():
        normalized_branch_city = "".join(
            character for character in unicodedata.normalize("NFKD", city.casefold())
            if not unicodedata.combining(character)
        )
        if normalized_branch_city in normalized_city:
            return city, address
    return None, None


def shared_catalog():
    with CATALOG_PATH.open(encoding="utf-8") as catalog_file:
        return json.load(catalog_file)


def exchange_rate(base_currency: str, quote_currency: str) -> float:
    base = base_currency.upper()
    quote_code = quote_currency.upper()
    if base == quote_code:
        return 1.0
    if not re.fullmatch(r"[A-Z]{3}", base) or not re.fullmatch(r"[A-Z]{3}", quote_code):
        raise HTTPException(status_code=503, detail="Currency conversion is not configured for this restaurant.")

    key = (base, quote_code)
    cached = _FX_RATE_CACHE.get(key)
    now = time.monotonic()
    if cached and now - cached[1] < FX_RATE_CACHE_SECONDS:
        return cached[0]

    request = UrlRequest(
        f"https://api.frankfurter.dev/v2/rate/{base}/{quote_code}",
        headers={"Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=7) as response:
            payload = json.loads(response.read().decode("utf-8"))
        rate = float(payload.get("rate"))
        if not math.isfinite(rate) or rate <= 0:
            raise ValueError("Invalid FX rate")
    except (HTTPError, URLError, TimeoutError, ValueError, OSError, TypeError) as error:
        raise HTTPException(status_code=503, detail="Current currency rates are unavailable. Please try again shortly.") from error

    _FX_RATE_CACHE[key] = (rate, now)
    return rate


def convert_currency_amount(amount: float | Decimal, base_currency: str, quote_currency: str) -> float:
    converted = Decimal(str(amount)) * Decimal(str(exchange_rate(base_currency, quote_currency)))
    precision = Decimal("1") if quote_currency.upper() == "COP" else Decimal("0.01")
    return float(converted.quantize(precision, rounding=ROUND_HALF_UP))


def geocode_address(address: str, country_code: Optional[str] = None):
    api_key = os.getenv("GOOGLE_GEOCODING_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Delivery distance checking is not configured. Choose pickup or contact the restaurant.")
    query = urlencode({"regionCode": country_code.lower()}) if country_code else ""
    query_suffix = f"?{query}" if query else ""
    request = Request(
        f"https://geocode.googleapis.com/v4/geocode/address/{quote(address, safe='')}{query_suffix}",
        headers={"X-Goog-Api-Key": api_key, "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=8) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        try:
            error_payload = json.loads(error.read().decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            error_payload = {}
        google_error = error_payload.get("error", {})
        print(f"Google Geocoding API HTTP {error.code}: {google_error.get('status', error.reason)} — {google_error.get('message', '')}")
        raise HTTPException(status_code=503, detail="Address checking is temporarily unavailable. Please try again or choose pickup.") from error
    except Exception as error:
        print(f"Address geocoding failed: {error}")
        raise HTTPException(status_code=503, detail="We could not check that address right now. Please try again or choose pickup.") from error
    if result.get("error"):
        google_error = result["error"]
        print(f"Google Geocoding API error: {google_error.get('status', google_error.get('code'))} — {google_error.get('message', '')}")
        raise HTTPException(status_code=503, detail="Address checking is temporarily unavailable. Please try again or choose pickup.")
    results = result.get("results") or []
    if not results:
        raise HTTPException(status_code=422, detail="We could not find that delivery address. Check the street, number, and postcode.")
    for geocode_result in results:
        point = geocode_result.get("location") or {}
        if "latitude" in point and "longitude" in point:
            return float(point["latitude"]), float(point["longitude"])
    raise HTTPException(status_code=422, detail="We could not find that delivery address. Check the street, number, postcode, city, and country.")


def delivery_distance_km(address: str, city: str):
    branch_name, branch = branch_for_city(city)
    if not branch:
        raise HTTPException(status_code=503, detail="Delivery is not configured for this restaurant.")
    if branch_name not in BRANCH_COORDINATES:
        BRANCH_COORDINATES[branch_name] = geocode_address(branch[0], branch[1])
    destination = geocode_address(address)
    lat1, lon1 = map(math.radians, BRANCH_COORDINATES[branch_name])
    lat2, lon2 = map(math.radians, destination)
    delta_lat, delta_lon = lat2 - lat1, lon2 - lon1
    haversine = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(min(1.0, haversine)))


def authenticated_customer(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        raise HTTPException(status_code=503, detail="Customer login verification is not configured.")
    request = UrlRequest(f"{supabase_url}/auth/v1/user", headers={
        "apikey": service_key, "Authorization": authorization, "Accept": "application/json",
    })
    try:
        with urlopen(request, timeout=6) as response:
            user = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        if error.code in (401, 403):
            raise HTTPException(status_code=401, detail="Your Brasaclub session expired. Sign in again before ordering.") from error
        raise HTTPException(status_code=503, detail="Could not verify the Brasaclub session.") from error
    except (URLError, TimeoutError, ValueError, OSError) as error:
        raise HTTPException(status_code=503, detail="Could not verify the Brasaclub session.") from error
    return {"id": str(user.get("id") or ""), "email": str(user.get("email") or "").strip().lower()}


class CustomerInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=80)


class CartItem(BaseModel):
    menuItemId: str = Field(min_length=1)
    quantity: int = Field(ge=1, le=50)


class CheckoutInput(BaseModel):
    locationId: str = Field(min_length=1)
    fulfillment: Literal["pickup", "delivery"]
    deliveryAddress: Optional[str] = None
    customer: CustomerInput
    notes: Optional[str] = Field(default=None, max_length=2000)
    items: list[CartItem] = Field(min_length=1)


class PaymentPreferenceInput(BaseModel):
    email: EmailStr
    paymentPreference: Literal["CASH", "PAYMENT_LINK", "BIZUM"]


@router.get("/menu/locations")
def online_locations():
    with engine.connect() as connection:
        rows = connection.execute(text('''
            SELECT DISTINCT ON (replace(lower(l."city"), 'í', 'i')) l."id", l."name", l."city", l."country", l."currency"
            FROM "Location" l
            LEFT JOIN "MenuItem" m ON m."locationId"=l."id" AND m."available"=TRUE
            WHERE replace(lower(l."city"), 'í', 'i') LIKE '%bogot%'
               OR replace(lower(l."city"), 'í', 'i') LIKE '%medell%'
               OR lower(l."city") LIKE '%cali%'
               OR lower(l."city") LIKE '%miami%'
               OR lower(l."city") LIKE '%orlando%'
            GROUP BY l."id", l."name", l."city", l."country", l."currency"
            ORDER BY replace(lower(l."city"), 'í', 'i'), count(m."id") DESC, l."name"
        ''' )).mappings().all()
    return [
        {
            **dict(row),
            # Delivery is priced at USD 5 and displayed in each restaurant's currency.
            "deliveryFee": convert_currency_amount(5, "USD", row["currency"]),
        }
        for row in rows
    ]


@router.get("/menu")
def online_menu(locationId: str = Query(min_length=1)):
    with engine.connect() as connection:
        location = connection.execute(text('SELECT "id", "currency" FROM "Location" WHERE "id"=:id'), {"id": locationId}).mappings().first()
        if not location:
            raise HTTPException(status_code=404, detail="Restaurant location not found.")
    return [
        {
            **item,
            "id": str(item["id"]),
            "locationId": locationId,
            "price": convert_currency_amount(item["price"], item.get("currency", "EUR"), location["currency"]),
            "currency": location["currency"],
            "available": True,
        }
        for item in shared_catalog()
    ]


@router.get("/ordering")
def ordering_catalog(locationId: Optional[str] = None):
    """Compatibility endpoint used by the public website on Vercel and Hostinger."""
    if locationId:
        return online_menu(locationId)
    return online_locations()


@router.post("/ordering/checkout", status_code=201)
@router.post("/ordering", status_code=201)
def create_online_order(payload: CheckoutInput, request: Request):
    if payload.fulfillment == "delivery" and not (payload.deliveryAddress or "").strip():
        raise HTTPException(status_code=400, detail="Delivery address is required.")
    item_ids = [item.menuItemId for item in payload.items]
    if len(item_ids) != len(set(item_ids)):
        raise HTTPException(status_code=400, detail="Each menu item can only appear once.")

    normalized_email = str(payload.customer.email).strip().lower()
    signed_in_customer = authenticated_customer(request.headers.get("authorization"))
    if signed_in_customer and signed_in_customer["email"] != normalized_email:
        raise HTTPException(status_code=403, detail="The signed-in Brasaclub email must match the order email.")
    if payload.fulfillment == "delivery":
        with engine.connect() as connection:
            selected_location = connection.execute(text('SELECT "city" FROM "Location" WHERE "id"=:id'), {"id": payload.locationId}).mappings().first()
        if not selected_location:
            raise HTTPException(status_code=404, detail="Restaurant location not found.")
        distance = delivery_distance_km(payload.deliveryAddress.strip(), selected_location["city"])
        if distance > DELIVERY_RADIUS_KM:
            raise HTTPException(status_code=422, detail=f"This address is {distance:.1f} km from the restaurant. Delivery is available only within 5 km. Choose pickup or enter an address closer to {selected_location['city']}.")

    try:
        with engine.begin() as connection:
            location = connection.execute(text('SELECT "id", "currency" FROM "Location" WHERE "id"=:id'), {"id": payload.locationId}).mappings().first()
            if not location:
                raise HTTPException(status_code=404, detail="Restaurant location not found.")

            catalog_by_id = {str(product["id"]): product for product in shared_catalog()}
            menu_items = {}
            for item in payload.items:
                product = catalog_by_id.get(item.menuItemId)
                if not product:
                    raise HTTPException(status_code=400, detail="A menu item is unavailable. Refresh the menu and try again.")
                menu_items[item.menuItemId] = product

            order_currency = location["currency"]
            menu_eur_rate = exchange_rate("EUR", order_currency)
            subtotal = sum(
                convert_currency_amount(
                    menu_items[item.menuItemId]["price"],
                    menu_items[item.menuItemId].get("currency", "EUR"),
                    order_currency,
                ) * item.quantity
                for item in payload.items
            )
            delivery_fee = convert_currency_amount(5, "USD", order_currency) if payload.fulfillment == "delivery" else 0
            customer = connection.execute(text('''
                SELECT "id", "authUserId" FROM "Customer" WHERE lower("email")=:email ORDER BY "createdAt" LIMIT 1 FOR UPDATE
            '''), {"email": normalized_email}).mappings().first()
            if customer:
                customer_id = customer["id"]
                member_account = connection.execute(text('''
                    SELECT id FROM "BrasapointsAccount" WHERE "customerId"=:customer_id
                '''), {"customer_id": customer_id}).mappings().first()
                if member_account and not signed_in_customer:
                    raise HTTPException(status_code=401, detail="This email belongs to a Brasaclub member. Sign in to use Brasapuntos and save this order to your account.")
                if member_account and customer["authUserId"] and customer["authUserId"] != signed_in_customer["id"]:
                    raise HTTPException(status_code=403, detail="This order email is linked to a different Brasaclub account.")
                connection.execute(text('''
                    UPDATE "Customer" SET "name"=:name, "phone"=:phone,
                      "authUserId"=COALESCE("authUserId", :auth_user_id), "updatedAt"=now() WHERE "id"=:id
                '''), {"id": customer_id, "name": payload.customer.name.strip(), "phone": payload.customer.phone.strip(),
                      "auth_user_id": signed_in_customer["id"] if signed_in_customer else None})
            else:
                customer_id = str(uuid4())
                connection.execute(text('''
                    INSERT INTO "Customer" ("id", "name", "email", "phone", "createdAt", "updatedAt", "authUserId")
                    VALUES (:id, :name, :email, :phone, now(), now(), :auth_user_id)
                '''), {"id": customer_id, "name": payload.customer.name.strip(), "email": normalized_email,
                      "phone": payload.customer.phone.strip(), "auth_user_id": signed_in_customer["id"] if signed_in_customer else None})

            order_id = str(uuid4())
            connection.execute(text('''
                INSERT INTO "Order" ("id", "customerId", "locationId", "currency", "menuEurRate", "subtotal", "deliveryFee", "discount", "total",
                  "status", "source", "fulfillment", "deliveryAddress", "customerNotes", "paymentStatus", "createdAt", "updatedAt")
                VALUES (:id, :customer_id, :location_id, :currency, :menu_eur_rate, :subtotal, :delivery_fee, 0, :total,
                  CAST('RECEIVED' AS "OrderStatus"), CAST('ONLINE' AS "OrderSource"), :fulfillment,
                  :address, :notes, CAST('PENDING' AS "PaymentStatus"), now(), now())
            '''), {"id": order_id, "customer_id": customer_id, "location_id": payload.locationId,
                  "currency": order_currency, "menu_eur_rate": menu_eur_rate, "subtotal": subtotal, "delivery_fee": delivery_fee, "total": subtotal + delivery_fee,
                  "fulfillment": payload.fulfillment, "address": payload.deliveryAddress if payload.fulfillment == "delivery" else None,
                  "notes": payload.notes.strip() if payload.notes else None})

            for item in payload.items:
                menu_item = menu_items[item.menuItemId]
                converted_price = convert_currency_amount(menu_item["price"], menu_item.get("currency", "EUR"), order_currency)
                line_total = converted_price * item.quantity
                connection.execute(text('''
                    INSERT INTO "OrderItem" ("id", "orderId", "dishName", "quantity", "unitPrice", "subtotal", "menuItemId")
                    VALUES (:id, :order_id, :name, :quantity, :price, :subtotal, :menu_id)
                '''), {"id": str(uuid4()), "order_id": order_id, "name": menu_item["name"], "quantity": item.quantity,
                      "price": converted_price, "subtotal": line_total, "menu_id": item.menuItemId})
            saved_totals = connection.execute(text('''
                SELECT total, "brasapointsDiscount", "brasapointsUsed", "brasapointsEarned"
                FROM "Order" WHERE id=:id
            '''), {"id": order_id}).mappings().one()
    except HTTPException:
        raise
    except Exception as error:
        print(f"Online order save failed: {error}")
        raise HTTPException(status_code=503, detail="Could not save the order to the ERP database.") from error

    return {"orderId": order_id, "status": "RECEIVED", "paymentStatus": "PENDING",
            "paymentOptions": ["PAYMENT_LINK", "CASH", "BIZUM"], "total": saved_totals["total"],
            "currency": order_currency, "brasapointsDiscount": saved_totals["brasapointsDiscount"],
            "brasapointsUsed": saved_totals["brasapointsUsed"], "brasapointsEarned": saved_totals["brasapointsEarned"],
            "message": "Order received. The restaurant will confirm availability and contact you to arrange payment."}


@router.patch("/ordering/{order_id}/payment-preference")
def save_payment_preference(order_id: str, payload: PaymentPreferenceInput):
    with engine.begin() as connection:
        order = connection.execute(text('''
            SELECT o."id", o."paymentStatus", c."email" FROM "Order" o
            JOIN "Customer" c ON c."id"=o."customerId" WHERE o."id"=:id
        '''), {"id": order_id}).mappings().first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")
        if (order["email"] or "").lower() != str(payload.email).lower():
            raise HTTPException(status_code=403, detail="This order does not match that email address.")
        if order["paymentStatus"] != "PENDING":
            raise HTTPException(status_code=409, detail="Payment preference can only be changed while payment is pending.")
        connection.execute(text('UPDATE "Order" SET "paymentPreference"=:preference, "updatedAt"=now() WHERE "id"=:id'),
                           {"preference": payload.paymentPreference, "id": order_id})
    return {"ok": True, "paymentPreference": payload.paymentPreference}
