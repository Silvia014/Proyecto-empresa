FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock README.md ./
COPY src/ ./src/
COPY services/api/ ./services/api/
COPY alembic.ini ./

RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app/services/api"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--app-dir", "/app/services/api", "--host", "0.0.0.0", "--port", "8000", "--reload"]
