
from logging.config import fileConfig
import os
import sys
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel


# Repository and API paths
REPO_ROOT = Path(__file__).resolve().parents[3]
API_DIR = REPO_ROOT / "services" / "api"

if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

# Load environment variables without overriding existing values.
load_dotenv(REPO_ROOT / ".env")
load_dotenv(REPO_ROOT / ".env.local")

# Import only the SQLModel models currently registered
# for the API's inventory and incident functionality.
from app.inventory.models import (  # noqa: E402, F401
    Location,
    InventoryItem,
    InventoryLot,
    InventoryMovement,
)
from app.incidents.models import IncidentRecord  # noqa: E402, F401
from app.supplier_directory_model import SupplierDirectoryRecord  # noqa: E402, F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not configured. "
        "Check the repository .env or .env.local file."
    )


# Only manage tables explicitly registered for this API.
# Do not autogenerate changes for Prisma or unrelated Supabase tables.
MANAGED_TABLES = {
    "inventory_items",
    "inventory_lots",
    "inventory_movements",
    "incidents",
    "supplier_directory",
}



def include_name(name, type_, parent_names):
    if type_ == "table":
        return name in MANAGED_TABLES
    return True


def include_object(obj, name, type_, reflected, compare_to):
    # Location is shared with Prisma and must not be managed by Alembic.
    if type_ == "table" and name == "Location":
        return False
    return True


def run_migrations_offline():
    context.configure(
        include_object=include_object,
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_name=include_name,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = DATABASE_URL

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    try:
        with connectable.connect() as connection:
            context.configure(
                include_object=include_object,
                connection=connection,
                target_metadata=target_metadata,
                include_name=include_name,
                compare_type=True,
            )

            with context.begin_transaction():
                context.run_migrations()
    finally:
        connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
