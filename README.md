# DataRoom MVP

A simple Data Room for file uploads, folder management, Google Drive import, and share links.

## What You Can Do

- Sign in with Firebase.
- Create folders and store files.
- Upload files from your computer.
- Import files from Google Drive.
- Rename, copy, move, and delete items.
- Search and sort content.
- Open file previews and share files via share links.

## Quick Start

1. Install dependencies:

```bash
cd frontend && npm install
cd ../backend && python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ..
```

2. Set up environment variables:

```bash
cp .env.example .env
```

3. Initialize the database:

```bash
npm run backend:init-db
```

4. Start the backend:

```bash
npm run backend
```

5. In a new terminal, start the frontend:

```bash
npm run frontend
```

Frontend: http://localhost:5173  
Backend API: http://localhost:5000

Production site: https://dataroom.prxgr4mm3r.xyz  
Production API: https://api.prxgr4mm3r.xyz

## How To Use

1. Sign in.
2. Create a folder or upload a file.
3. Import files from Google Drive when needed.
4. Create a share link when you need to grant access.

## MVP Limitations

- Requires configured Firebase token verification and SMTP for magic links.
- Google Drive integration works only with valid OAuth credentials.
- Built for local/dev usage.

## More Details

- `backend/openapi.yaml` - API contract.
- `backend/README.md` - backend details.
- `frontend/README.md` - frontend details.
