# Data Room Frontend (Vertical Slice v1)

React + TypeScript frontend for Data Room Explorer shell.

## Stack

- React + Vite + TypeScript
- React Router
- TanStack Query
- Firebase Web Auth
- Axios
- Zustand
- Mantine (wrapped via `shared/ui`)
- OpenAPI generated types (`openapi-typescript`)
- Vitest + Testing Library

## Environment

Copy `frontend/.env.example` to `frontend/.env` and fill values:

```bash
VITE_API_BASE_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

## Scripts

```bash
npm --prefix frontend run dev
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run build
npm --prefix frontend run generate:api-types
```

## Implemented v1 slice

- Firebase sign-in gate + `/api/me` bootstrap
- Explorer shell: sidebar, toolbar, breadcrumbs, table, preview pane, bulk bar scaffold
- URL-driven folder navigation: `/dataroom`, `/dataroom/f/:folderId`
- URL-driven preview: `?preview=:itemId`
- Google integration status/connect flow and OAuth callback route
- Google Drive file browsing/import into current folder
- Server-driven sorting (`name`, `type`, `size`, `imported_at`)
- Selection state independent from preview open state

## Notes

- UI layer is isolated via `shared/ui` wrappers to keep visual stack swappable.
- OpenAPI types are generated to `src/shared/api/openapi/schema.ts`.
