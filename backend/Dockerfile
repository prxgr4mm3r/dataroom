FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn

COPY . .

EXPOSE 5000

CMD ["sh", "-c", "alembic upgrade head && exec gunicorn --bind 0.0.0.0:5000 --workers 2 --threads 4 --timeout 120 run:app"]
