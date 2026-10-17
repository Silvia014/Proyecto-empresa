
from datetime import datetime
from pathlib import Path
import sys

from sqlmodel import Session, select
from tinydb import TinyDB
from sqlalchemy import text


API_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = API_DIR.parents[1]

if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.database import DB_PATH, engine
from app.supplier_directory_model import SupplierDirectoryRecord


def main() -> None:
    if not Path(DB_PATH).exists():
        raise FileNotFoundError(
            f"TinyDB file not found: {DB_PATH}"
        )

    source_db = TinyDB(DB_PATH)

    try:
        # Only migrate the default TinyDB table containing suppliers.
        source_records = source_db.all()

        migrated = 0
        skipped = 0

        with Session(engine) as session:
            for record in source_records:
                supplier_id = record.doc_id
                data = dict(record)

                updated_at = data.get("updated_at")
                if isinstance(updated_at, str):
                    data["updated_at"] = datetime.fromisoformat(
                        updated_at.replace("Z", "+00:00")
                    )

                existing = session.get(
                    SupplierDirectoryRecord, supplier_id
                )

                if existing is not None:
                    # Do not overwrite an existing PostgreSQL record.
                    skipped += 1
                    continue

                supplier = SupplierDirectoryRecord(
                    id=supplier_id,
                    name=data["name"],
                    country=data["country"],
                    categories=data["categories"],
                    rate_per_unit=float(data["rate_per_unit"]),
                    currency=data["currency"],
                    status=data["status"],
                    contact_email=data.get("contact_email"),
                    notes=data.get("notes"),
                    updated_at=data["updated_at"],
                )

                session.add(supplier)
                migrated += 1

            session.commit()

            # Keep future auto-generated IDs above imported IDs.
            session.execute(
                text(
                    """
                    SELECT setval(
                        pg_get_serial_sequence(
                            'public.supplier_directory', 'id'
                        ),
                        COALESCE(
                            (SELECT MAX(id) FROM public.supplier_directory),
                            1
                        ),
                        EXISTS (
                            SELECT 1 FROM public.supplier_directory
                        )
                    )
                    """
                )
            )
            session.commit()

        print(f"Source records: {len(source_records)}")
        print(f"Inserted into PostgreSQL: {migrated}")
        print(f"Skipped existing IDs: {skipped}")
        print("TinyDB source file was preserved.")

    finally:
        source_db.close()


if __name__ == "__main__":
    main()
