# Project instructions

## Architecture
- Use layered frontend architecture: app, pages, widgets, features, entities, shared.
- Do not introduce cyclic dependencies.
- Import only through public APIs (`index.ts`).
- Keep modules focused and small.
- Do not put business logic in UI-only components.

## UI rules
- Sidebar, toolbar, content pane, preview pane, and bulk actions must stay decoupled.
- Selection state and opened state must be separate.
- Google Drive must not appear inside the folder tree.
- Main view is table-first, but implementation must allow adding grid view later.
- Prefer calm, clean B2B UI over decorative visuals.

## Quality
- Keep components readable and composable.
- Prefer extracting hooks/services over growing components.
- Reuse shared primitives before creating duplicates.