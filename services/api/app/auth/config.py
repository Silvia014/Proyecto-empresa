import os


JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "dev-secret-change-this-in-production",
)

JWT_ALGORITHM = "HS256"

JWT_EXPIRE_MINUTES = int(
    os.getenv("JWT_EXPIRE_MINUTES", "30")
)
