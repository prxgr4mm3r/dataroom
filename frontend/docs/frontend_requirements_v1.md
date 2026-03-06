# Frontend Requirements — Data Room v1

## 1. Document purpose
This document defines the approved frontend requirements for the Data Room application.
It consolidates the agreed product scope, UX decisions, and architectural constraints for the first version of the frontend.

The goal is to design a clean, extensible frontend architecture that supports the current MVP and allows future growth without large refactors.

---

## 2. Product focus
The main workspace of the application is **Data Room**.

Google Drive is treated as an **external import source**, not as a second full workspace inside the application.

The frontend should feel like a **desktop-like file manager** with Explorer-style navigation.

---

## 3. Functional requirements

### 3.1. Authentication and user context
The application must support:
- authentication through Firebase;
- loading and displaying the current user;
- protected access to the application after successful authentication.

### 3.2. Google Drive integration
The application must support:
- viewing current Google Drive connection status;
- connecting Google Drive;
- disconnecting Google Drive;
- handling expired Google integration and reconnect flow.

### 3.3. Import file
The application must provide a single user action: **Import file**.

This action must support two import sources:
- **Import from Google Drive**;
- **Upload from computer**.

#### Import from Google Drive
The user must be able to:
- open the import flow for Google Drive;
- see available files from Google Drive;
- choose a file;
- import the selected file into Data Room.

#### Upload from computer
The user must be able to:
- drag and drop a file into the upload area;
- open the system file picker and choose a file manually.

> Note: local upload is a planned product requirement. It may require backend/API extension compared to the current server contract.

### 3.4. Data Room content
The application must support:
- viewing the content of the current folder;
- viewing imported files inside Data Room;
- opening a file for preview;
- deleting a file from Data Room;
- creating folders;
- navigating nested folders.

### 3.5. Duplicate names
Within the same folder, file and folder names must be unique.

If the user copies or imports an item whose name already exists in the target folder, the app must auto-rename it using a Windows Explorer-like strategy:
- `file.pdf`
- `file (1).pdf`
- `file (2).pdf`

Names must never be treated as identifiers. All actions must rely on entity IDs.

### 3.6. Folders
The application must support:
- folders;
- nested folders;
- navigation through folder hierarchy.

### 3.7. Copy and move operations
The application must support:
- copying files;
- copying folders recursively;
- moving files between folders;
- moving folders between folders.

Rules:
- copied entities receive new IDs;
- moving a folder into itself is forbidden;
- moving a folder into its own descendant is forbidden.

### 3.8. Selection and bulk actions
The application must support multi-selection.

Selection behavior:
- each row has a checkbox on the left;
- selecting via checkbox marks the item for bulk actions;
- clicking the row content opens the item instead of selecting it.

Bulk actions bar must appear when at least one item is selected.

At minimum it must support:
- Copy;
- Move;
- Delete;
- Clear selection;
- selected items count.

### 3.9. Keyboard shortcuts
The application must be designed to support keyboard shortcuts.

Approved baseline shortcuts:
- `Ctrl/Cmd + C` — copy;
- `Ctrl/Cmd + V` — paste;
- `Delete` — delete;
- `Enter` — open;
- `Ctrl/Cmd + Shift + N` — create new folder.

### 3.10. Sorting
The table view must support sorting by clicking column headers.

Sorting must support at least:
- Name;
- Type;
- Size;
- Imported at.

Sorting rules:
- folders are always displayed first;
- within folders and within files, selected sort order is applied;
- ascending and descending order must be supported.

### 3.11. Search extensibility
Search is **not required in v1**.

However, the architecture must allow adding later:
- search by file name;
- future full-text search.

---

## 4. Layout and shell requirements

### 4.1. Main layout
The application must use **Explorer-style layout**.

Main areas:
- **Left sidebar** — Data Room folder tree;
- **Top toolbar** — global actions;
- **Breadcrumbs row** — current navigation path;
- **Content pane** — table view of current folder content;
- **Right preview pane** — resizable preview area.

### 4.2. Sidebar
The left sidebar must display only the **Data Room folder tree**.

It must not contain Google Drive as a parallel tree.

The sidebar architecture must be extensible for future additions such as:
- Favorites;
- pinned locations.

### 4.3. Toolbar
The first version must keep the toolbar minimalistic.

Mandatory toolbar actions:
- New folder;
- Import file.

The toolbar must be architected for future expansion with:
- Search;
- Sort menu;
- view mode switcher;
- additional file actions.

### 4.4. Breadcrumbs
Breadcrumbs are required.

Requirements:
- show full navigation path starting from `Data Room`;
- all intermediate segments are clickable;
- the current folder is shown as the last segment;
- for long paths, middle segments may collapse into `...`;
- clicking `...` opens a list of upper-level folders in the path.

---

## 5. Navigation and routing requirements

### 5.1. URL-driven navigation
Navigation state must be reflected in the URL.

Requirements:
- current folder changes the URL;
- browser Back/Forward must work naturally;
- refresh must restore the same folder context.

Recommended route model:
- `/dataroom/f/:folderId`

### 5.2. Preview state in URL
The opened preview item must also be reflected in the URL.

Recommended route model:
- `/dataroom/f/:folderId?preview=:fileId`

Requirements:
- opening a file changes preview state in URL;
- closing preview removes preview query parameter;
- current folder must remain unchanged when preview is closed.

### 5.3. URL as source of truth
Routing must be the source of truth for:
- current folder;
- current preview item.

Sidebar, breadcrumbs, content pane, and preview pane must stay synchronized with route state.

---

## 6. Content pane requirements

### 6.1. View mode
The first version must use **table/list view**.

The architecture must support adding **grid view** later without refactoring the domain/state model.

### 6.2. Table columns
Approved initial columns:
- Checkbox;
- Name;
- Type;
- Size;
- Imported at;
- Status;
- Actions.

`Source` is not required in v1.

### 6.3. Item order
Inside the current folder:
- folders must appear first;
- files must appear after folders;
- there must be no visual separator between the two groups;
- folders should be distinguishable visually in a soft, native way.

### 6.4. Row interaction
Approved interaction model:
- checkbox click — select item;
- row content click — open item;
- selected state and opened state are different states.

---

## 7. Preview requirements

### 7.1. Preview location
Preview must open inside the application in a **right-side pane**.

### 7.2. Preview pane behavior
Requirements:
- preview pane is resizable;
- preview does not navigate the user away from the current screen;
- clicking another file updates the preview pane.

### 7.3. Supported preview behavior
The preview area should support inline preview where possible, including typical browser-previewable file types.

If inline preview is not supported, the UI must show a fallback state with actions such as:
- open in new tab;
- download.

---

## 8. Empty, loading, and error states
The frontend must include dedicated states for:
- loading;
- empty folder / empty Data Room;
- Google Drive not connected;
- Google reconnect required;
- failed import or delete action;
- unsupported preview type;
- preview error / missing file.

Error handling approach:
- toast for action result feedback;
- inline state where context matters.

---

## 9. Architectural requirements

### 9.1. General principles
The frontend must be designed for:
- clean separation of concerns;
- extensibility;
- route-driven state where appropriate;
- reusable UI and domain logic.

### 9.2. Domain separation
The architecture should separate at least the following domains:
- auth;
- Google integration;
- Data Room file system;
- preview;
- UI shell.

### 9.3. State requirements
The application must support distinct state layers for:
- active folder;
- opened preview item;
- selected item IDs;
- clipboard state;
- drag state;
- sort state;
- integration state;
- UI feedback state.

### 9.4. View-mode independence
The content domain/state must not be tightly coupled to table rendering.

This is required so that future grid view can reuse the same:
- entities;
- selection model;
- sorting model;
- clipboard operations;
- drag-and-drop logic.

### 9.5. Search-ready architecture
Even though search is postponed, the list state and route model should allow later introduction of:
- `searchQuery`;
- filters;
- server-side search params.

---

## 10. Scope notes

### 10.1. Core scope aligned with current assignment
Core flows aligned with the current assignment are:
- user auth context;
- Google Drive connection;
- Google Drive import;
- Data Room file list;
- file preview;
- file delete;
- loading/error/reconnect handling.

### 10.2. Product extensions beyond the base assignment/API
The following are approved as product extensions and may require backend/OpenAPI updates:
- local upload from computer;
- folders and nested folders;
- copy/move operations;
- recursive folder copy;
- drag-and-drop move;
- keyboard shortcuts;
- URL-based folder tree navigation;
- favorites;
- richer shell behavior.

---

## 11. Final summary
The frontend must be built as a clean, extensible Explorer-style Data Room application.

Version 1 should already feel structured and scalable, even if some advanced capabilities are introduced later through backend expansion.

The architectural baseline is:
- Data Room as the main workspace;
- Google Drive as an import source;
- route-driven folder + preview state;
- table-first content view;
- right-side resizable preview;
- strong support for future folder/file operations and search.
