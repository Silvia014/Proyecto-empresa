from pathlib import Path

from tinydb import Query, TinyDB


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

DATA_DIR.mkdir(exist_ok=True)

DB_PATH = DATA_DIR / "suppliers.json"

db = TinyDB(DB_PATH)

# Existing supplier storage
supplier_query = Query()

# Authentication / profile storage
users_table = db.table("users")
profiles_table = db.table("profiles")
incidents_table = db.table("incidents")
password_reset_tokens_table = db.table("password_reset_tokens")