FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY alembic.ini pyproject.toml ./
COPY alembic ./alembic
COPY app ./app
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && useradd -m fork && mkdir -p /app/media && chown -R fork /app
USER fork
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD curl -fsS http://localhost:8000/health || exit 1
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
