# Frontend

React + TypeScript app for the Data Room UI.

## What it does

- Signs users in with Firebase
- Opens the main Data Room explorer
- Uploads files from device
- Imports files from Google Drive
- Supports folders, preview, search, sorting, bulk actions, and share view

## Stack

- React 19 + Vite + TypeScript
- React Router
- TanStack Query
- Firebase Web Auth
- Zustand
- Mantine via `src/shared/ui`
- Tailwind CSS v4
- Vitest + Testing Library

## Setup

Create `frontend/.env` from `frontend/.env.example`:

```bash
VITE_API_BASE_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

Optional:

```bash
VITE_MAX_IMPORT_FILE_SIZE_BYTES=4194304
VITE_GOOGLE_PICKER_API_KEY=
VITE_GOOGLE_PICKER_APP_ID=
```

## Scripts

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run generate:api-types
```

## Structure

- `src/app` app bootstrap, providers, global styles
- `src/pages` route-level pages
- `src/widgets` composed UI blocks
- `src/features` user actions and flows
- `src/entities` domain entities
- `src/shared` api client, config, ui primitives, helpers

## Notes

- API types are generated from `../backend/openapi.yaml` into `src/shared/api/openapi/schema.ts`.
- More architecture details live in `frontend/docs/`.
