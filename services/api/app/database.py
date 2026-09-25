from pathlib import Path

from tinydb import Query, TinyDB


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_PATH = DATA_DIR / "suppliers.json"

db = TinyDB(DB_PATH)
supplier_query = Query()
