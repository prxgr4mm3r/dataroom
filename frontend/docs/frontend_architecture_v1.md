# Frontend Architecture — Data Room v1

## 1. Purpose
This document defines a clean, extensible frontend architecture for the Data Room application.

The architecture must satisfy these goals:
- modular and readable codebase;
- no “god modules” or files with mixed responsibilities;
- no cyclic dependencies;
- single responsibility per module;
- SOLID-oriented design;
- easy future extension for folders, copy/move, local upload, search, favorites, and alternative views.

This architecture is designed for **React + TypeScript** and assumes the already approved product requirements from `frontend_requirements_v1.md`.

---

## 2. Architectural principles

### 2.1. Core principles
1. **Single Responsibility**  
   Each module does one thing: render UI, manage state, describe a domain entity, call an API, or implement a user action.

2. **Dependency Rule**  
   Dependencies must always point from higher-level composition layers to lower-level reusable layers.

3. **No cyclic dependencies**  
   A slice must not import itself indirectly through another slice.

4. **Explicit public API**  
   Every slice exports only through `index.ts`. Deep imports are forbidden.

5. **Composition over inheritance**  
   UI should be assembled from small composable components.

6. **Separation of server state and UI state**  
   Remote API data and local interaction state must not be mixed into one giant store.

7. **URL as navigation state**  
   Folder navigation and preview state are route-driven.

8. **Future-proof design**  
   Current implementation is minimal, but extension points must exist for:
   - grid view;
   - search;
   - favorites;
   - sort menu;
   - local upload;
   - richer file actions.

---

## 3. Recommended technology choices

### 3.1. Core stack
- **React**
- **TypeScript**
- **Vite**
- **React Router** for route-driven navigation
- **TanStack Query** for server state
- **Zustand** for lightweight local interaction state where React local state is not enough
- **React Hook Form** only where form behavior is non-trivial
- **Axios** or a thin typed fetch client for HTTP

### 3.2. Why this stack
- **React Router** cleanly models folder and preview state in URL.
- **TanStack Query** prevents writing a custom async state framework.
- **Zustand** is suitable for narrow UI state like selection, clipboard, preview pane width, drag state.
- Avoid a single global app store for everything.

### 3.3. Strong recommendation for API typing
Generate API types from the OpenAPI contract.

Recommended options:
- generate TypeScript types only;
- wrap them in a small handwritten API client;
- keep request/response mapping close to domain modules.

Do **not** spread raw backend DTOs throughout the UI tree.

---

## 4. Layered structure

Recommended top-level structure:

```text
src/
  app/
  pages/
  widgets/
  features/
  entities/
  shared/
```

### 4.1. Layer responsibilities

#### `app/`
Global composition layer.

Contains:
- app bootstrap;
- providers;
- router;
- global styles;
- app-level config;
- error boundary;
- query client setup;
- auth provider setup.

#### `pages/`
Route-level pages.

Contains:
- page composition;
- route params parsing;
- page layout assembly.

Must not contain heavy business logic.

#### `widgets/`
Large UI blocks assembled from features and entities.

Examples:
- Explorer shell;
- Sidebar tree;
- Top toolbar;
- Breadcrumbs;
- Content table;
- Preview pane.

Widgets can coordinate UI composition, but should not become “mini-pages with everything inside”.

#### `features/`
User actions and interaction use cases.

Examples:
- connect Google Drive;
- import file;
- create folder;
- copy items;
- move items;
- delete items;
- select items;
- sort items;
- open preview.

A feature owns the logic of a user action.

#### `entities/`
Business entities and their local helpers.

Examples:
- current user;
- Google integration;
- Data Room item;
- folder tree node;
- previewable file metadata.

Entities define:
- domain types;
- mappers from DTO to domain model;
- pure helpers;
- small reusable UI fragments tied to that entity.

#### `shared/`
Reusable, domain-agnostic foundation.

Examples:
- UI kit;
- API base client;
- utility functions;
- routing helpers;
- constants;
- generic hooks;
- config;
- validation helpers.

`shared/` must not depend on app-specific business domains.

---

## 5. Dependency rules

The allowed dependency direction is:

```text
app -> pages -> widgets -> features -> entities -> shared
```

### 5.1. Allowed imports
- `app` may import from any lower layer.
- `pages` may import from `widgets`, `features`, `entities`, `shared`.
- `widgets` may import from `features`, `entities`, `shared`.
- `features` may import from `entities`, `shared`.
- `entities` may import only from `shared`.
- `shared` imports from nothing above itself.

### 5.2. Forbidden imports
- `entities` importing from `features`, `widgets`, `pages`, `app`
- `features` importing from `widgets`, `pages`, `app`
- `widgets` importing from `pages`, `app`
- cross-layer back references of any kind
- deep imports bypassing another slice’s public API

### 5.3. Public API rule
Every slice must expose a public API through `index.ts`.

Allowed:
```ts
import { ContentTable } from '@/widgets/content-table';
import { useSelectionStore } from '@/features/select-items';
```

Forbidden:
```ts
import { ContentTable } from '@/widgets/content-table/ui/content-table/content-table';
```

---

## 6. Slice design

Each slice should have only the folders it actually needs.

Recommended internal structure:

```text
slice-name/
  ui/
  model/
  api/
  lib/
  config/
  index.ts
```

### 6.1. Folder meaning
- `ui/` — React components only
- `model/` — hooks, state, selectors, domain logic, actions
- `api/` — requests for this slice only
- `lib/` — pure helpers for this slice
- `config/` — local constants/config
- `index.ts` — public exports only

### 6.2. Slice rules
- A slice should not contain all folders “just in case”.
- If a slice has no API, do not create `api/`.
- If a slice has no local helpers, do not create `lib/`.
- Avoid empty abstraction layers.

---

## 7. Recommended domain model

### 7.1. Main domain entity
The UI should operate on a unified domain model:

```ts
export type DataRoomItem = DataRoomFile | DataRoomFolder;
```

With a discriminant:

```ts
kind: 'file' | 'folder'
```

### 7.2. Why unified item model
This avoids duplicate list logic for:
- selection;
- ordering;
- copy/move behavior;
- breadcrumbs integration;
- table and future grid rendering.

### 7.3. Suggested entity modules
- `entities/user`
- `entities/google-integration`
- `entities/data-room-item`
- `entities/folder-tree-node`

### 7.4. DTO vs domain model
Backend DTOs must be mapped into domain models near `entities/*`.

Do not let raw API response shapes become your app-wide source of truth.

---

## 8. Recommended project structure

```text
src/
  app/
    providers/
      router/
      query-client/
      auth/
      theme/
    styles/
    App.tsx
    main.tsx

  pages/
    data-room-page/
      ui/
        data-room-page.tsx
      model/
        use-data-room-route.ts
      index.ts

  widgets/
    explorer-shell/
      ui/
      index.ts

    sidebar-tree/
      ui/
      model/
      index.ts

    top-toolbar/
      ui/
      index.ts

    breadcrumbs/
      ui/
      index.ts

    content-table/
      ui/
      model/
      index.ts

    preview-pane/
      ui/
      model/
      index.ts

    bulk-actions-bar/
      ui/
      index.ts

  features/
    auth/
      model/
      api/
      index.ts

    connect-google-drive/
      ui/
      model/
      api/
      index.ts

    disconnect-google-drive/
      ui/
      model/
      api/
      index.ts

    import-file/
      ui/
      model/
      index.ts

    import-from-google/
      ui/
      model/
      api/
      index.ts

    upload-local-file/
      ui/
      model/
      api/
      index.ts

    create-folder/
      ui/
      model/
      api/
      index.ts

    select-items/
      model/
      index.ts

    sort-items/
      model/
      index.ts

    open-preview/
      model/
      index.ts

    delete-items/
      ui/
      model/
      api/
      index.ts

    copy-items/
      model/
      api/
      index.ts

    move-items/
      model/
      api/
      index.ts

  entities/
    user/
      model/
      api/
      index.ts

    google-integration/
      model/
      api/
      ui/
      index.ts

    data-room-item/
      model/
      lib/
      ui/
      index.ts

    folder-tree-node/
      model/
      lib/
      index.ts

  shared/
    api/
      client.ts
      endpoints.ts
      openapi/
    config/
    lib/
    model/
    hooks/
    routes/
    ui/
    types/
```

---

## 9. Page composition

### 9.1. `DataRoomPage` responsibilities
The page should:
- read route params and query params;
- connect route state to widgets;
- assemble the shell.

The page should **not** directly implement:
- selection logic;
- copy/move/delete logic;
- API request details;
- sorting algorithms;
- preview rendering details.

### 9.2. Recommended composition
`DataRoomPage` composes:
- `ExplorerShell`
  - `SidebarTree`
  - `TopToolbar`
  - `Breadcrumbs`
  - `BulkActionsBar`
  - `ContentTable`
  - `PreviewPane`

---

## 10. State management strategy

### 10.1. State categories
Split state into 4 categories.

#### A. Route state
Source of truth: URL

Contains:
- current folder id;
- preview file id;
- future search query;
- future sort params if you decide to keep them in URL.

#### B. Server state
Source of truth: backend API via TanStack Query

Contains:
- current user;
- Google integration status;
- folder content;
- folder tree;
- file metadata;
- preview content metadata;
- mutations and invalidation.

#### C. Interaction state
Source of truth: local store or widget-local model

Contains:
- selected ids;
- clipboard state;
- drag state;
- preview pane width;
- open dialogs;
- pending action targets.

#### D. Ephemeral component state
Source of truth: local component state

Contains:
- hover states;
- uncontrolled local UI transitions;
- popover open/close where global coordination is not needed.

### 10.2. Important state rules
- Do not store server entities in Zustand if TanStack Query already owns them.
- Do not store route state in a separate global store.
- Do not create one giant “useAppStore”.

### 10.3. Good local stores
Suitable for Zustand:
- selection store;
- clipboard store;
- preview pane UI store;
- drag session store.

---

## 11. URL model

Recommended URL structure:

```text
/dataroom
/dataroom/f/:folderId
/dataroom/f/:folderId?preview=:fileId
```

### 11.1. URL rules
- folder id lives in path;
- preview file id lives in query param;
- closing preview removes query param only;
- Back/Forward must restore both folder and preview state.

### 11.2. Why this matters
This keeps navigation predictable and avoids hidden state.

---

## 12. Data fetching strategy

### 12.1. Query ownership
Each feature or entity owns only its relevant queries/mutations.

Examples:
- `entities/user/api` — current user query
- `entities/google-integration/api` — integration status query
- `features/import-from-google/api` — import mutation
- `features/create-folder/api` — create folder mutation

### 12.2. Query key policy
Keep query keys centralized and typed.

Recommended style:
```ts
['data-room', 'folder-content', folderId]
['data-room', 'folder-tree']
['google', 'integration-status']
['user', 'me']
```

### 12.3. Mutation policy
Mutations must:
- invalidate only relevant queries;
- not force a full-page refetch when avoidable;
- optimistically update only when behavior is stable and simple.

---

## 13. UI module design rules

### 13.1. Components should be small
Guideline targets:
- presentational component: preferably under 150 lines;
- complex widget root: preferably under 200 lines;
- hook/model file: preferably under 120 lines;
- utility/helper: small and pure.

If a file grows beyond this, split by responsibility.

### 13.2. Presentational vs model split
A good pattern:
- `ui/` renders
- `model/` decides behavior

Example:
- `content-table/ui/content-table.tsx`
- `content-table/model/use-content-table.ts`

### 13.3. Avoid hook pyramids in page files
Do not create pages that call 15 hooks and manually wire every interaction.
Move orchestration into widgets/features.

### 13.4. Keep event handlers close to features
Delete logic belongs to `features/delete-items`, not to a generic row component.

---

## 14. Recommended feature boundaries

### 14.1. `features/select-items`
Owns:
- selection state;
- toggle select;
- clear selection;
- select all in visible list;
- selected count;
- future range select if needed.

Does not own:
- item rendering;
- file preview.

### 14.2. `features/open-preview`
Owns:
- open item into preview;
- close preview;
- sync preview with URL.

### 14.3. `features/import-file`
Owns:
- entry point UI for import;
- choosing import source;
- delegating to Google or local upload flow.

### 14.4. `features/import-from-google`
Owns:
- Google file picker state;
- import mutation;
- reconnect-required handling inside import flow.

### 14.5. `features/upload-local-file`
Owns:
- drag-and-drop zone;
- local file picker open action;
- upload mutation.

### 14.6. `features/create-folder`
Owns:
- create folder dialog;
- validation;
- duplicate name strategy integration.

### 14.7. `features/delete-items`
Owns:
- delete confirmation;
- bulk delete action;
- mutation and invalidation.

### 14.8. `features/copy-items`
Owns:
- copy command;
- clipboard serialization;
- duplicate-name handling at paste target.

### 14.9. `features/move-items`
Owns:
- move action;
- target resolution;
- forbidden folder move constraints.

### 14.10. `features/sort-items`
Owns:
- current sort model;
- sort toggling from table headers;
- sorting helpers for visible content.

---

## 15. Entity design rules

### 15.1. `entities/data-room-item`
Must contain:
- unified item types;
- type guards;
- item icon helpers;
- display helpers for item metadata;
- possibly small UI like `ItemIcon`, `ItemNameCellContent`.

Must not contain:
- selection logic;
- delete logic;
- preview routing logic.

### 15.2. `entities/google-integration`
Must contain:
- integration status model;
- query for status;
- mapping from API response to domain shape;
- status badge UI if needed.

### 15.3. `entities/user`
Must contain:
- current user model;
- current user query;
- user mapping helpers.

---

## 16. Widgets design rules

### 16.1. `SidebarTree`
Responsible for:
- rendering folder tree;
- current folder highlighting;
- route navigation on click.

Not responsible for:
- creating folders;
- moving items;
- import flow.

### 16.2. `TopToolbar`
Responsible for:
- rendering global actions;
- delegating action clicks to features.

Not responsible for:
- action business logic;
- selection state.

### 16.3. `ContentTable`
Responsible for:
- rendering current folder items;
- table headers;
- checkbox column;
- row open behavior;
- sort header interaction wiring.

Not responsible for:
- deletion business logic;
- copy/move logic.

### 16.4. `PreviewPane`
Responsible for:
- preview layout;
- metadata display;
- resizable pane UI;
- unsupported-preview fallback UI.

Business logic for opening/closing belongs to `features/open-preview`.

### 16.5. `Breadcrumbs`
Responsible for:
- rendering current path;
- collapse-to-ellipsis behavior;
- path segment navigation.

---

## 17. Handling future extensibility

The architecture must support adding later without refactoring core layers:
- grid view;
- favorites;
- search by name;
- full-text search;
- richer sort/filter model;
- local upload;
- item details side panel;
- extra providers beyond Google Drive.

### 17.1. Key design decisions that make this possible
- unified `DataRoomItem` model;
- route-driven navigation;
- separate server state and interaction state;
- feature-owned actions;
- widgets as composition blocks;
- explicit public APIs.

---

## 18. Anti-patterns to avoid

1. **One giant `DataRoomPage.tsx`** that contains API calls, layout, modals, selection logic, and preview logic.
2. **One giant `useAppStore`** with every server entity and every UI flag.
3. **Deep imports** bypassing slice public APIs.
4. **Re-exporting everything from everywhere** until layer boundaries stop meaning anything.
5. **Raw backend DTOs in presentational components**.
6. **Business logic inside generic UI kit components**.
7. **Copy/move/delete logic inside row components**.
8. **Folder navigation state duplicated in both URL and store**.
9. **Feature modules importing each other in circles**.
10. **Utility dumping ground** in `shared/lib` with unrelated code.

---

## 19. Enforcing architecture technically

### 19.1. TypeScript path aliases
Use aliases like:
- `@/app/*`
- `@/pages/*`
- `@/widgets/*`
- `@/features/*`
- `@/entities/*`
- `@/shared/*`

### 19.2. Lint rules
Use ESLint rules or a boundaries plugin to enforce layer imports.

Required checks:
- no forbidden layer imports;
- no deep imports across slices;
- no unused exports if possible.

### 19.3. Cycle detection
Add a cycle detector in CI.

Examples:
- `madge`
- `dependency-cruiser`

### 19.4. PR review checklist
Every PR should answer:
- what slice owns this responsibility?
- does this create a new cross-layer dependency?
- is this business logic in the correct layer?
- does this module need to be split?
- does this change bypass public APIs?

---

## 20. Suggested conventions

### Naming
- components: `PascalCase`
- hooks: `useXxx`
- stores: `xxx.store.ts`
- pure helpers: `xxx.ts`
- DTO mappers: `mapXxxDto.ts`

### Index files
Each slice root has one `index.ts`.
Do not create nested barrel hell inside every subfolder unless it helps clarity.

### Tests
Prioritize testing:
- pure entity helpers;
- feature model logic;
- route parsing helpers;
- item sorting and duplicate naming rules.

---

## 21. Architecture decisions for this project

### Approved decisions
- Explorer-style shell
- table-first view
- future grid support
- URL-driven folder navigation
- preview in URL
- preview in resizable right pane
- selection via checkbox
- bulk actions bar
- folders first ordering
- sorting by table columns
- no search in v1, but search-ready design
- Data Room as the only sidebar tree
- Google Drive as import provider, not a second workspace

---

## 22. Backend contract implications

The current backend contract is sufficient for:
- auth/user context;
- Google integration status/connect/disconnect;
- listing Google files;
- importing from Google;
- listing files;
- file preview;
- file delete.

The following approved frontend requirements require backend/API extension later:
- folders and nested folders;
- folder tree;
- create folder;
- copy items;
- move items;
- local upload;
- unified item model with `kind` and `parent_id`;
- bulk operations;
- richer sort/search params if moved server-side.

This means the frontend architecture should be designed now for those concepts even if some endpoints are introduced later.

---

## 23. Final recommendation

Use a **layered Feature-Sliced-inspired architecture** with strict dependency boundaries.

This gives the best balance between:
- modularity;
- readability;
- clean growth path;
- SOLID-oriented responsibility boundaries;
- practical implementation speed for a take-home project.

It is more maintainable than:
- page-centric monoliths;
- ad-hoc folders by file type only;
- one global store architecture;
- premature micro-abstractions without clear ownership.
