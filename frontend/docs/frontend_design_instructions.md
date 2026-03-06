Design and implement the frontend UI for a B2B Data Room application.

Goal:
Create a clean, modern, desktop-like file manager experience focused on clarity, hierarchy, and efficient document workflows. The UI should feel like a professional product, not a marketing page.

Product context:
- This is a Data Room application.
- Main user tasks: navigate folders, import files, browse files, preview files, move/copy items, and manage documents efficiently.
- Google Drive is an import source, not part of the main folder tree.

Layout requirements:
- Explorer-style shell.
- Left sidebar: Data Room folder tree only.
- Top toolbar: minimal and extensible.
- Breadcrumbs under the toolbar.
- Center panel: table/list view of the current folder.
- Right panel: resizable preview pane.

Behavior requirements:
- Folders appear above files.
- No hard separator between folders and files.
- First column is a checkbox for selection.
- Clicking the row opens the file in the preview pane.
- Selection state and opened state must be separate.
- Show a bulk actions bar when one or more items are selected.
- Breadcrumbs must support collapsing long paths into "...", and clicking "..." should show higher-level folders.
- The current folder must be reflected in the URL.
- The opened preview item must also be reflected in the URL.

Import requirements:
- One "Import file" action.
- Import sources:
  1) Google Drive
  2) Upload from computer
- Local upload UI must support drag-and-drop and a file picker button.

Table requirements:
- Main mode is table/list view.
- Architecture must allow adding grid view later without refactoring core logic.
- Sorting by column headers must be supported.
- Required columns: Name, Type, Size, Imported at, Status, Actions.

Preview requirements:
- Preview opens in the right-side pane.
- The pane must be resizable.
- Support good empty/loading/error/unsupported states.
- Unsupported file types should show metadata and fallback actions.

Visual design direction:
- Calm, modern B2B aesthetic.
- Minimalistic, polished, restrained.
- Light theme first.
- Neutral palette.
- Soft borders, subtle shadows.
- Spacious layout.
- Strong readability and information hierarchy.
- No flashy gradients, no playful startup marketing look.

Architecture constraints:
- React + TypeScript.
- Clean modular architecture.
- No giant components.
- No cyclic dependencies.
- Single responsibility per module.
- Use a composable shell.
- Keep table, preview, sidebar, toolbar, and bulk actions decoupled.
- Prepare for future extensibility: grid view, favorites, search, more sort options.

Accessibility requirements:
- Visible keyboard focus states.
- Comfortable hit areas.
- Accessible checkboxes, tree navigation, row actions, and resize handle.

Please do the work in this order:
1. First, produce a concise UI plan.
2. Then provide a component map with responsibilities.
3. Then implement the UI.
4. Then provide a checklist showing how each requirement is satisfied.

Do not create an overly flashy design.
Do not mix selection and open behavior into one click.
Do not place Google Drive inside the folder tree.