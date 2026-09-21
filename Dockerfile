FROM python:3.14-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

COPY pyproject.toml uv.lock README.md ./

RUN pip install --no-cache-dir uv \
    && uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY backend ./backend
COPY migrations ./migrations
COPY alembic.ini ./

EXPOSE 8000

CMD ["uv", "run", "--no-dev", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]