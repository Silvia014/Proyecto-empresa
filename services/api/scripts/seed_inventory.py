
from app.database import create_db_and_tables, get_db
from app.inventory.seed import seed_inventory


def main() -> None:
    create_db_and_tables()

    with next(get_db()) as session:
        seed_inventory(session)

    print("Inventory seed completed successfully.")


if __name__ == "__main__":
    main()
