from services.api.app.crud import create_supplier
from services.api.app.database import db


SUPPLIERS = [
    {
        "name": "Colombia Fresh Foods",
        "country": "Colombia",
        "product_categories": ["vegetables", "sauces"],
        "rate": 25.0,
        "status": "active",
    },
    {
        "name": "Florida Meat Supply",
        "country": "Florida",
        "product_categories": ["meat"],
        "rate": 42.5,
        "status": "active",
    },
    {
        "name": "CleanPack Solutions",
        "country": "Colombia",
        "product_categories": ["packaging", "cleaning"],
        "rate": 18.75,
        "status": "active",
    },
]


def main():
    inserted = 0

    existing_names = {
        supplier["name"]
        for supplier in db.all()
    }

    for supplier in SUPPLIERS:
        if supplier["name"] in existing_names:
            continue

        create_supplier(supplier)
        inserted += 1

    print(f"Inserted {inserted} suppliers.")


if __name__ == "__main__":
    main()
