from __future__ import annotations

import base64
import json
import logging
import os
import re
import unicodedata
from datetime import date, datetime, time, timedelta
from pathlib import PurePath
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text

from .database import engine

router = APIRouter(prefix="/api", tags=["public intake"])
logger = logging.getLogger("api.public_intake")
MAX_CV_BYTES = 3 * 1024 * 1024
COUNTRY_CITIES = {
    "colombia": {"bogota": "Bogotá", "medellin": "Medellín", "cali": "Cali"},
    "usa": {"miami": "Miami", "orlando": "Orlando"},
}
CV_TYPES = {
    ".pdf": ("application/pdf", b"%PDF-"),
    ".doc": ("application/msword", bytes([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])),
    ".docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", b"PK"),
}


def _normalize(value: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", value.casefold()) if not unicodedata.combining(ch)).strip()


def _email_html(subject: str, rows: list[tuple[str, str]], intro: str = "") -> str:
    escape = lambda value: (str(value or "—").replace("&", "&amp;").replace("<", "&lt;")
                            .replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;"))
    detail_rows = "".join(f"<tr><th align=\"left\" style=\"padding:8px\">{escape(label)}</th><td style=\"padding:8px\">{escape(value)}</td></tr>" for label, value in rows)
    return ("<!doctype html><html><body style=\"margin:0;background:#f7f1e7;color:#382b24;font-family:Arial,sans-serif\">"
            "<main style=\"max-width:620px;margin:32px auto;padding:28px;background:#fffdf9;border-radius:16px\">"
            "<p style=\"color:#762b3e;font-weight:bold;letter-spacing:.12em\">BRASALAND</p>"
            f"<h1 style=\"color:#762b3e\">{escape(subject)}</h1><p>{escape(intro)}</p>"
            f"<table style=\"width:100%;border-collapse:collapse\">{detail_rows}</table></main></body></html>")


def _send_email(to: str, subject: str, html: str, text_body: str) -> bool:
    api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM_EMAIL")
    if not api_key or not from_email:
        logger.warning("Email skipped: Resend configuration is missing.")
        return False
    request = Request(
        "https://api.resend.com/emails",
        data=json.dumps({"from": from_email, "to": [to], "subject": subject, "html": html, "text": text_body}).encode(),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=8) as response:
            return 200 <= response.status < 300
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        logger.error("Resend delivery failed (%s).", type(exc).__name__)
        return False


class ReservationInput(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    apellidos: str = Field(min_length=2, max_length=120)
    email: EmailStr
    telefono: str = Field(min_length=6, max_length=40)
    pais: str
    ciudad: str
    personas: int = Field(ge=1, le=20)
    dia: date
    hora: time
    notas: Optional[str] = Field(default=None, max_length=2000)
    ubicacion: Optional[str] = Field(default="sin_preferencia", max_length=80)
    comoNosConociste: Optional[str] = Field(default=None, max_length=100)
    idioma: Optional[str] = "es"


class CandidateInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=80)
    position: str = Field(min_length=2, max_length=160)
    linkedin_url: Optional[str] = Field(default=None, max_length=500)
    experience_years: int = Field(default=0, ge=0, le=80)
    language: Optional[str] = "es"
    cv_filename: str = Field(min_length=1, max_length=200)
    cv_type: str
    cv_base64: str


def _resolve_city(country: str, city: str) -> str:
    choices = COUNTRY_CITIES.get(country.casefold())
    if not choices:
        raise HTTPException(status_code=400, detail="Select a supported country.")
    resolved = choices.get(_normalize(city))
    if not resolved:
        raise HTTPException(status_code=400, detail="Select a city that belongs to the selected country.")
    return resolved


def _send_reservation_emails(payload: ReservationInput, city: str, country: str) -> tuple[bool, bool]:
    english = payload.idioma == "en"
    customer_subject = "Reservation received!" if english else "¡Reserva recibida!"
    customer_message = (
        "We've sent a copy of the request to your email. Our team will check availability and contact you if anything changes."
        if english else "Hemos enviado una copia de la solicitud a tu email. Nuestro equipo comprobará la disponibilidad y te contactará si hay algún cambio."
    )
    details = [
        ("Date" if english else "Fecha", payload.dia.isoformat()),
        ("Time" if english else "Hora", payload.hora.strftime("%H:%M")),
        ("Guests" if english else "Personas", str(payload.personas)),
        ("Restaurant" if english else "Restaurante", f"{city}, {country}"),
        ("Seating" if english else "Ubicación", payload.ubicacion or "sin_preferencia"),
    ]
    customer_sent = _send_email(str(payload.email), customer_subject, _email_html(customer_subject, details, f"Hello {payload.nombre}, {customer_message}"), f"{customer_subject}\n\n{customer_message}")
    staff_subject = f"New online reservation · {city} · {payload.dia.isoformat()} {payload.hora.strftime('%H:%M')}"
    staff_details = [
        ("Name", f"{payload.nombre} {payload.apellidos}"), ("Email", str(payload.email)), ("Phone", payload.telefono),
        ("Country / city", f"{country} · {city}"), ("Date", payload.dia.isoformat()), ("Time", payload.hora.strftime("%H:%M")),
        ("Guests", str(payload.personas)), ("Seating", payload.ubicacion or "No preference"),
        ("Preferences", payload.notas or "—"), ("Referral", payload.comoNosConociste or "—"),
    ]
    staff_text = "New Brasaland online reservation\n" + "\n".join(f"{key}: {value}" for key, value in staff_details)
    staff_sent = _send_email(os.getenv("RESERVATION_NOTIFICATION_EMAIL", "reservas@brasaland.site"), staff_subject, _email_html(staff_subject, staff_details), staff_text)
    return customer_sent, staff_sent


@router.post("/reservas", status_code=201)
def create_reservation(payload: ReservationInput):
    city = _resolve_city(payload.pais, payload.ciudad)
    if payload.hora < time(11, 0) or payload.hora > time(22, 0):
        raise HTTPException(status_code=400, detail="Reservations are available from 11:00 to 22:00.")
    today = date.today()
    if payload.dia < today or payload.dia > today + timedelta(days=92):
        raise HTTPException(status_code=400, detail="Choose a reservation date within the next three months.")

    try:
        with engine.begin() as connection:
            location = connection.execute(text('''
                SELECT id, country, city FROM public."Location"
                WHERE lower(city) LIKE :city_pattern
                ORDER BY id LIMIT 1
            '''), {"city_pattern": {
                "bogota": "bogot%",
                "medellin": "medell%",
                "cali": "cali%",
                "miami": "miami%",
                "orlando": "orlando%",
            }[_normalize(city)]}).mappings().first()
            saved_city = location["city"] if location else city
            saved_country = location["country"] if location else ("USA" if payload.pais == "usa" else "Colombia")
            customer_id = connection.execute(text("""
                SELECT public.ensure_brasaland_customer(NULL, :name, :email, :phone, :country, :city, false)
            """), {"name": f"{payload.nombre.strip()} {payload.apellidos.strip()}", "email": str(payload.email).strip().lower(),
                  "phone": payload.telefono.strip(), "country": saved_country, "city": saved_city}).scalar_one()
            reservation_id = str(uuid4())
            connection.execute(text("""
                INSERT INTO public.reservations
                    (id, customer_id, first_name, last_name, email, phone, country, city, party_size,
                     reservation_date, reservation_time, location_preference, notes, referral_source, source, location_id)
                VALUES (:id, :customer_id, :first_name, :last_name, :email, :phone, :country, :city, :party_size,
                        :reservation_date, :reservation_time, :location_preference, :notes, :referral_source, 'ONLINE', :location_id)
            """), {"id": reservation_id, "customer_id": customer_id, "first_name": payload.nombre.strip(),
                  "last_name": payload.apellidos.strip(), "email": str(payload.email).strip().lower(), "phone": payload.telefono.strip(),
                  "country": saved_country, "city": saved_city, "party_size": payload.personas, "reservation_date": payload.dia,
                  "reservation_time": payload.hora, "location_preference": payload.ubicacion or "sin_preferencia",
                  "notes": payload.notas, "referral_source": payload.comoNosConociste, "location_id": location["id"] if location else None})
    except HTTPException:
        raise
    except Exception:
        logger.exception("Public reservation could not be persisted.")
        raise HTTPException(status_code=503, detail="We could not save the reservation. Please try again or contact the restaurant.")

    confirmation_sent, restaurant_sent = _send_reservation_emails(payload, saved_city, saved_country)
    return {"ok": True, "reservationId": reservation_id, "confirmationEmailSent": confirmation_sent,
            "restaurantNotificationSent": restaurant_sent}


def _storage_request(method: str, object_path: str, data: Optional[bytes] = None, content_type: str = "application/json"):
    supabase_url = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not supabase_url or not service_key:
        raise HTTPException(status_code=503, detail="CV storage is not configured on the server.")
    request = Request(f"{supabase_url}/storage/v1/object/candidate-cvs/{quote(object_path, safe='/')}", data=data,
                      headers={"apikey": service_key, "Authorization": f"Bearer {service_key}", "Content-Type": content_type}, method=method)
    try:
        with urlopen(request, timeout=15) as response:
            return response.read()
    except HTTPError as exc:
        logger.error("Candidate CV storage returned HTTP %s.", exc.code)
        raise HTTPException(status_code=503, detail="We could not store the CV. Please try again later.") from exc
    except (URLError, TimeoutError, OSError) as exc:
        logger.error("Candidate CV storage failed (%s).", type(exc).__name__)
        raise HTTPException(status_code=503, detail="CV storage is temporarily unavailable.") from exc


@router.post("/candidate", status_code=201)
def create_candidate(payload: CandidateInput):
    filename = PurePath(payload.cv_filename.replace("\\", "/")).name
    extension = PurePath(filename).suffix.casefold()
    expected = CV_TYPES.get(extension)
    if not expected or payload.cv_type not in {expected[0], "application/octet-stream"}:
        raise HTTPException(status_code=400, detail="Upload a CV in PDF, DOC, or DOCX format.")
    try:
        file_bytes = base64.b64decode(payload.cv_base64, validate=True)
    except (ValueError, base64.binascii.Error) as exc:
        raise HTTPException(status_code=400, detail="The uploaded CV could not be read.") from exc
    if not file_bytes or len(file_bytes) > MAX_CV_BYTES or not file_bytes.startswith(expected[1]):
        raise HTTPException(status_code=400, detail="Check that the CV is valid and no larger than 3 MB.")

    object_path = f"{datetime.utcnow().date().isoformat()}/{uuid4()}{extension}"
    _storage_request("POST", object_path, file_bytes, expected[0])
    candidate_id = str(uuid4())
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                INSERT INTO public.candidate_applications
                    (id, full_name, email, phone, position, linkedin_url, experience_years, cv_path, cv_filename)
                VALUES (:id, :full_name, :email, :phone, :position, :linkedin_url, :experience_years, :cv_path, :cv_filename)
            """), {"id": candidate_id, "full_name": payload.full_name.strip(), "email": str(payload.email).strip().lower(),
                  "phone": payload.phone.strip(), "position": payload.position.strip(), "linkedin_url": payload.linkedin_url,
                  "experience_years": payload.experience_years, "cv_path": object_path, "cv_filename": filename})
    except Exception:
        try:
            _storage_request("DELETE", object_path)
        except HTTPException:
            logger.warning("Could not remove orphaned CV after candidate insert failure.")
        logger.exception("Candidate application could not be persisted.")
        raise HTTPException(status_code=503, detail="We could not save your application. Please try again.")

    english = payload.language == "en"
    subject = "We received your application" if english else "Hemos recibido tu candidatura"
    message = ("Thank you for your interest in Brasaland. Our team will review your application and contact you by email if your profile matches an open position."
               if english else "Gracias por tu interés en Brasaland. Nuestro equipo revisará tu candidatura y te contactará por email si tu perfil encaja con una vacante.")
    sent = _send_email(str(payload.email), subject, _email_html(subject, [("Position", payload.position), ("Application", candidate_id)], f"Hello {payload.full_name}, {message}"), f"{subject}\n\n{message}")
    return {"ok": True, "id": candidate_id, "confirmationEmailSent": sent}
