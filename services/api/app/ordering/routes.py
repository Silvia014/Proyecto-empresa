from __future__ import annotations

from typing import Literal, Optional
from pathlib import Path
import json
import math
import os
import unicodedata
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text

from ..database import engine

router = APIRouter(prefix="/api")
CATALOG_PATH = Path(__file__).with_name("catalog.json")
DELIVERY_RADIUS_KM = 5.0
BRANCH_ADDRESSES = {
    "Bogotá": ("Callejón del Embudo 5, 110111 Bogotá, Colombia", "CO"),
    "Orlando": ("123 Church Street, Orlando, FL 32801, USA", "US"),
}
BRANCH_COORDINATES = {}


def branch_for_city(city: str):
    normalized_city = "".join(
        character for character in unicodedata.normalize("NFKD", city.casefold())
        if not unicodedata.combining(character)
    ).strip()
    if "bogota" in normalized_city:
        return "Bogotá", BRANCH_ADDRESSES["Bogotá"]
    if "orlando" in normalized_city:
        return "Orlando", BRANCH_ADDRESSES["Orlando"]
    return None, None


def shared_catalog():
    with CATALOG_PATH.open(encoding="utf-8") as catalog_file:
        return json.load(catalog_file)


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
            SELECT DISTINCT ON (lower(l."city")) l."id", l."name", l."city", l."country", l."currency"
            FROM "Location" l
            LEFT JOIN "MenuItem" m ON m."locationId"=l."id" AND m."available"=TRUE
            WHERE lower(l."city") LIKE '%bogot%' OR lower(l."city") LIKE '%orlando%'
            GROUP BY l."id", l."name", l."city", l."country", l."currency"
            ORDER BY lower(l."city"), count(m."id") DESC, l."name"
        ''' )).mappings().all()
    return [dict(row) for row in rows]


@router.get("/menu")
def online_menu(locationId: str = Query(min_length=1)):
    with engine.connect() as connection:
        location = connection.execute(text('SELECT "id" FROM "Location" WHERE "id"=:id'), {"id": locationId}).mappings().first()
        if not location:
            raise HTTPException(status_code=404, detail="Restaurant location not found.")
    return [{**item, "id": str(item["id"]), "locationId": locationId, "available": True} for item in shared_catalog()]


@router.post("/ordering/checkout", status_code=201)
def create_online_order(payload: CheckoutInput):
    if payload.fulfillment == "delivery" and not (payload.deliveryAddress or "").strip():
        raise HTTPException(status_code=400, detail="Delivery address is required.")
    item_ids = [item.menuItemId for item in payload.items]
    if len(item_ids) != len(set(item_ids)):
        raise HTTPException(status_code=400, detail="Each menu item can only appear once.")

    normalized_email = str(payload.customer.email).strip().lower()
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

            subtotal = sum(float(menu_items[item.menuItemId]["price"]) * item.quantity for item in payload.items)
            order_currency = menu_items[payload.items[0].menuItemId]["currency"]
            customer = connection.execute(text('''
                SELECT "id" FROM "Customer" WHERE lower("email")=:email ORDER BY "createdAt" LIMIT 1 FOR UPDATE
            '''), {"email": normalized_email}).mappings().first()
            if customer:
                customer_id = customer["id"]
                connection.execute(text('''
                    UPDATE "Customer" SET "name"=:name, "phone"=:phone, "updatedAt"=now() WHERE "id"=:id
                '''), {"id": customer_id, "name": payload.customer.name.strip(), "phone": payload.customer.phone.strip()})
            else:
                customer_id = str(uuid4())
                connection.execute(text('''
                    INSERT INTO "Customer" ("id", "name", "email", "phone", "createdAt", "updatedAt")
                    VALUES (:id, :name, :email, :phone, now(), now())
                '''), {"id": customer_id, "name": payload.customer.name.strip(), "email": normalized_email, "phone": payload.customer.phone.strip()})

            order_id = str(uuid4())
            connection.execute(text('''
                INSERT INTO "Order" ("id", "customerId", "locationId", "currency", "subtotal", "discount", "total",
                  "status", "source", "fulfillment", "deliveryAddress", "customerNotes", "paymentStatus", "createdAt", "updatedAt")
                VALUES (:id, :customer_id, :location_id, :currency, :subtotal, 0, :total,
                  CAST('RECEIVED' AS "OrderStatus"), CAST('ONLINE' AS "OrderSource"), :fulfillment,
                  :address, :notes, CAST('PENDING' AS "PaymentStatus"), now(), now())
            '''), {"id": order_id, "customer_id": customer_id, "location_id": payload.locationId,
                  "currency": order_currency, "subtotal": subtotal, "total": subtotal,
                  "fulfillment": payload.fulfillment, "address": payload.deliveryAddress if payload.fulfillment == "delivery" else None,
                  "notes": payload.notes.strip() if payload.notes else None})

            for item in payload.items:
                menu_item = menu_items[item.menuItemId]
                line_total = float(menu_item["price"]) * item.quantity
                connection.execute(text('''
                    INSERT INTO "OrderItem" ("id", "orderId", "dishName", "quantity", "unitPrice", "subtotal", "menuItemId")
                    VALUES (:id, :order_id, :name, :quantity, :price, :subtotal, :menu_id)
                '''), {"id": str(uuid4()), "order_id": order_id, "name": menu_item["name"], "quantity": item.quantity,
                      "price": menu_item["price"], "subtotal": line_total, "menu_id": item.menuItemId})
    except HTTPException:
        raise
    except Exception as error:
        print(f"Online order save failed: {error}")
        raise HTTPException(status_code=503, detail="Could not save the order to the ERP database.") from error

    return {"orderId": order_id, "status": "RECEIVED", "paymentStatus": "PENDING",
            "paymentOptions": ["PAYMENT_LINK", "CASH", "BIZUM"], "total": subtotal,
            "currency": order_currency,
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
