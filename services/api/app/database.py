import os
from pathlib import Path

from dotenv import load_dotenv
from tinydb import Query, TinyDB
from sqlmodel import Session, SQLModel, create_engine


# ---------------------------------------------------------
# ENVIRONMENT
# ---------------------------------------------------------

ROOT_DIR = Path(__file__).resolve().parents[3]

load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR / ".env.local")


# ---------------------------------------------------------
# TINYDB
# Existing authentication / users database
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

DATA_DIR.mkdir(exist_ok=True)

DB_PATH = DATA_DIR / "suppliers.json"

db = TinyDB(DB_PATH)

supplier_query = Query()

users_table = db.table("users")
profiles_table = db.table("profiles")
incidents_table = db.table("incidents")
password_reset_tokens_table = db.table("password_reset_tokens")


# ---------------------------------------------------------
# SUPABASE / POSTGRESQL
# Inventory database
# ---------------------------------------------------------

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not configured.")


engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)


# ---------------------------------------------------------
# SQLMODEL SESSION
# ---------------------------------------------------------

def get_db():
    """
    Creates one SQLModel session per request.
    """
    with Session(engine) as session:
        yield session


# ---------------------------------------------------------
# DATABASE INITIALIZATION
# ---------------------------------------------------------

def create_db_and_tables():
    """
    Creates SQLModel tables that do not already exist.
    """
    SQLModel.metadata.create_all(engine)