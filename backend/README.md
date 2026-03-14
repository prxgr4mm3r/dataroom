# Backend

Flask API for the Data Room application.

## What it does

- Verifies Firebase auth tokens
- Sends magic sign-in links over SMTP
- Handles Google OAuth and Drive import
- Manages folders, files, moves, copies, deletes, and downloads
- Creates and serves share links, including public share access

OpenAPI spec: `backend/openapi.yaml`

## API reference

Most endpoints use Firebase bearer auth. Public exceptions are health check, Google OAuth callback, magic link request, and public share routes.

- `GET /api/health` checks that the API is up
- `POST /api/auth/magic-link` sends a sign-in link to email
- `GET /api/me` returns the current authenticated user

- `GET /api/integrations/google/status` returns Google Drive connection state
- `POST /api/integrations/google/connect` starts Google OAuth
- `GET /api/integrations/google/callback` finishes Google OAuth
- `DELETE /api/integrations/google/disconnect` removes Google connection
- `GET /api/integrations/google/files` lists importable Google Drive files
- `GET /api/integrations/google/picker-token` returns access token for Google Picker

- `GET /api/folders/tree` returns the folder tree
- `POST /api/folders` creates a folder

- `GET /api/items` lists items in a folder
- `GET /api/items/{item_id}` returns item metadata
- `GET /api/items/{item_id}/content` returns file content for preview/download
- `POST /api/items/download` downloads one or more items
- `POST /api/items/{item_id}/move` moves one item
- `POST /api/items/{item_id}/copy` copies one item
- `PATCH /api/items/{item_id}/rename` renames one item
- `POST /api/items/bulk-move` moves many items
- `POST /api/items/bulk-copy` copies many items
- `POST /api/items/bulk-delete` deletes many items

- `POST /api/files/upload` uploads a local file
- `POST /api/files/import-from-google` imports a file from Google Drive

- `GET /api/shares` lists share links created by the current user
- `POST /api/shares` creates a read-only share link
- `DELETE /api/shares/{share_id}` revokes a share link

- `GET /api/public/shares/{token}/meta` returns public share metadata
- `GET /api/public/shares/{token}/items` lists shared items
- `GET /api/public/shares/{token}/search` searches inside a shared tree
- `GET /api/public/shares/{token}/folders/tree` returns shared folder tree
- `GET /api/public/shares/{token}/items/{item_id}` returns shared item metadata
- `GET /api/public/shares/{token}/items/{item_id}/content` returns shared file content
- `POST /api/public/shares/{token}/download` downloads shared items

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Project config is read from the root `.env` file. Start from `.env.example`.

Important groups:

- Core: `SECRET_KEY`, `DATABASE_URL`, `FRONTEND_URL`
- Storage: `UPLOAD_DIR`
- Firebase: `FIREBASE_PROJECT_ID`, `FIREBASE_CREDENTIALS_JSON`
- Magic link email: `AUTH_MAGIC_LINK_CONTINUE_URL`, `MAIL_*`
- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Security: `TOKEN_ENCRYPTION_KEY`, `SHARE_TOKEN_PEPPER`

## Run

```bash
cd backend
.venv/bin/flask --app run.py init-db
.venv/bin/flask --app run.py run --debug
```

## Migrations

```bash
cd backend
.venv/bin/alembic upgrade head
```

If migration `20260311_0007` fails because of duplicate root names, run the remediation SQL from `migrations/sql/20260311_0007_remediate_root_duplicates.sql` and retry.

## Tests

```bash
cd backend
.venv/bin/python -m unittest discover -s tests
```

## Structure

- `app/routes` HTTP endpoints
- `app/services` business logic
- `app/repositories` database access
- `app/models` SQLAlchemy models
- `migrations` Alembic history
- `tests` API and policy tests

## Notes

- Uploaded files are stored on local disk.
- Non-development environments must use non-default security keys.
