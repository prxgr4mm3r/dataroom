# Backend MVP

Flask backend for Data Room MVP with:
- Firebase ID token verification for app auth
- Firebase-generated magic link emails sent via SMTP
- Google Drive OAuth (server-side) with token storage
- Local disk file storage and hierarchical Data Room filesystem API

OpenAPI spec: `backend/openapi.yaml`

## Run

1. Create virtualenv and install deps:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Configure env in project root (`.env`) based on `.env.example`.
   For magic-link email delivery you must configure `MAIL_*` SMTP variables and `MAIL_FROM_EMAIL`.

3. Initialize DB schema:

```bash
cd backend
.venv/bin/flask --app run.py init-db
```

4. Start API server:

```bash
cd backend
.venv/bin/flask --app run.py run --debug
```

## Migrations (Alembic)

```bash
cd backend
.venv/bin/alembic upgrade head
```

## Test

```bash
cd backend
.venv/bin/python -m unittest discover -s tests
```
