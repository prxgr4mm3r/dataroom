# Import File Dialog Baseline (pre-tailwind migration)

## 1) Scope and purpose

This document captures the current baseline of `Import from Google Drive` dialog **after rollback of 2 Tailwind migration commits**.

Goal: freeze current behavior and visuals so the next Tailwind migration can be done without regressions.

Captured from:
- `frontend/src/widgets/import-file-dialog/ui/import-file-dialog.tsx`
- `frontend/src/widgets/import-file-dialog/ui/import-file-dialog.css`
- `frontend/src/app/providers/theme-provider.tsx`
- `frontend/src/app/styles/globals.css`
- `frontend/src/app/styles/tokens.css`
- `frontend/src/shared/ui/selection-checkbox.tsx`
- `frontend/src/shared/lib/file/import-file-size-limit.ts`

Baseline commit at capture time: `3096c0a`.

## 2) Component identity

- Component: `ImportFileDialog`
- File: `frontend/src/widgets/import-file-dialog/ui/import-file-dialog.tsx`
- Purpose: browse Google Drive files, select one or multiple files, import into current folder.
- Integration point: opened from file table actions/shortcuts (`Import from Google Drive`).

## 3) High-level state model

Primary states:
- `googleStatusQuery.isPending` -> top loading state-card ("Checking Google Drive connection...").
- `canImport = isGoogleConnected && !tokenExpired`
- `!canImport && tokenExpired` -> reconnect panel.
- `!canImport && !tokenExpired` -> connect card.
- `canImport` -> full Google Drive browser UI.

Secondary async states inside browser:
- `googleFilesQuery.isPending` -> loading state-card ("Loading Google Drive files...").
- `googleFilesQuery.error` -> red `Alert` with API error text.
- `visibleGoogleFiles.length === 0` and no pending/error -> empty-state block.

## 4) Modal shell and geometry

Rendered via Mantine `Modal` with project-level theme overrides.

Modal props in component:
- `opened={opened}`
- `onClose={onClose}`
- `title={custom header content}`
- `size={!canImport ? 'md' : 'xl'}`
- `centered`
- classNames overrides:
  - `content: import-file-dialog__modal-content (+ --compact)`
  - `body: import-file-dialog__modal-body (+ --compact)`
  - `header: import-file-dialog__modal-shell-header`
  - `close: import-file-dialog__modal-close`

Project-wide modal theme (important visual baseline):
- Overlay: `rgb(7 15 32 / 64%)` + blur 3px.
- Modal content border: `1px solid var(--border-muted)`.
- Modal content background: `var(--bg-surface)`.
- Shadow: `var(--shadow-soft)`.
- Modal header background: `var(--bg-subtle)`.

Local shell geometry:
- `content` height: `min(860px, calc(100dvh - 32px))`.
- Compact content (`!canImport`): `height:auto; max-height: calc(100dvh - 32px)`.
- Body fills available height and hides overflow.
- Header padding: `10px 16px`.

Close button:
- Styled through `.app-modal-close` globally and locally resets focus outline for this dialog (`import-file-dialog__modal-close`).

## 5) Header composition

Header (`import-file-dialog__modal-header`) layout:
- Horizontal flex, center aligned, gap `16px`, full width.
- Left: title text `Import from Google Drive` (fw700, ~0.95rem).
- Right: optional status chip row (`showHeaderStatusRow`).

Status chip row (`import-file-dialog__header-status-row`):
- Inline-flex, rounded pill (`999px`), border 1px, subtle background.
- Padding: `4px 10px 4px 8px`.
- Max width: `min(42vw, 420px)`.
- Contains, left to right:
  - Google Drive icon (14x12)
  - optional status label
  - optional connected email (truncated)
  - optional disconnect text-button with logout icon

Status tones (`connected`, `warning`, `loading`, `disconnected`) currently share almost identical neutral visual colors. This is important: no strong color accent in chip by state.

Disconnect control:
- Borderless text button in chip.
- Font 12px semibold.
- Hover switches to primary text color.
- Disabled opacity 0.55.

## 6) Body layout

Main body stack:
- `Stack.import-file-dialog` -> column, `flex:1`, `min-height:0`.
- Inner `Stack.import-file-dialog__main` -> `flex:1`, overflow hidden.
- Compact mode (`!canImport`) disables fixed flex growth.

### 6.1 Connection cards (when `!canImport`)

Common visuals:
- Neutral bordered cards using `var(--border-soft)` and `var(--bg-surface/subtle)`.

A) Token expired (`tokenExpired`):
- `import-file-dialog__reconnect-panel`
- Title: `Reconnect Google Drive`
- Description: session expired
- Primary-looking reconnect button:
  - Class modifier `--reconnect`
  - Explicit blue fill `#63abff` (hover `#79b8ff`)
  - White text

B) Not connected:
- `import-file-dialog__connect-card`
- Title: `Connect Google Drive`
- Description: link account
- Neutral default-variant button with Drive icon and text from i18n (`connectGoogle`)

### 6.2 Browser mode (`canImport`)

Container `import-file-dialog__drive-browser`:
- Vertical layout with `gap:12px`
- `flex:1`, `min-height:0`, overflow hidden
- Top controls + content region

## 7) Controls row (search/tabs/sort)

Controls wrapper:
- Bottom border only (`1px solid var(--separator-muted)`), transparent bg
- Padding: `6px 0 10px`

Toolbar layout:
- `Group` with `justify=space-between`, `nowrap`, `gap:8px`
- On small screens (<860): becomes vertical column.

### 7.1 Search input

- Full-width flexible block (`flex:1`)
- Placeholder: `Search in Google Drive`
- Left icon: search 16px
- Input metrics:
  - min-height `36px`
  - radius `8px`
  - bg `var(--bg-surface)`
  - border `var(--border-muted)`
- Autofocus behavior: after open (RAF), only when `opened && canImport`.

### 7.2 Drive source tabs

Buttons: `Recent`, `My Drive`, `Shared`
- Default variant buttons with custom class.
- Shape: radius `8px`, min-height `32px`, px `10px`, fw600.
- Rest: transparent bg, transparent border, secondary text color.
- Hover: subtle bg + muted border.
- Active: `var(--bg-subtle)` + muted border + primary text.

Behavior:
- Changing tab clears selection.
- Sort auto-reset:
  - `my_drive` -> `name_asc`
  - others -> `modified_desc`

### 7.3 Sort controls

Label: `Sort` (xs, muted)
Buttons: `Latest`, `A-Z`, `Size`
- Visual style mirrors tab button style.
- Sort group separated by a left divider (`1px solid var(--separator-muted)` + 10px left padding).

## 8) File list area

`import-file-dialog__drive-browser-content`:
- Column flex region, `gap:8px`, fills remaining height.

Scrollable panel (`import-file-dialog__drive-browser-scroll`):
- Border 1px `var(--separator-muted)`
- Radius `10px`
- Bg `var(--bg-surface)`
- Grid column template variable:
  - `32px minmax(0, 1.9fr) minmax(118px, 1fr) 94px 128px 88px`

### 8.1 Grid header row

Sticky header (`position: sticky; top:0; z-index:1`)
- Bg `var(--bg-subtle)`
- Bottom border `var(--separator-soft)`
- Padding `10px 12px`
- Column labels: `Name`, `Type`, `Size`, `Updated`

### 8.2 File rows

Each row is a clickable grid (`role='checkbox'` for selectable rows):
- Padding `10px 12px`
- Bottom border `var(--separator-soft)`
- Hover: background `var(--bg-hover-soft)` + stronger bottom border.
- Selected row modifier: `background: var(--bg-subtle)`.

Too-large row modifier (`--too-large`):
- Background `var(--state-danger-bg-soft)`.
- Cursor `not-allowed`.
- Hover keeps danger background and uses danger border.
- Not keyboard selectable (`tabIndex=-1`, no checkbox role semantics).

### 8.3 Row cells

Cell 1: Selection checkbox
- Radix checkbox, 18x18, radius 5, border 1.5.
- Uses tokenized states for hover/checked/disabled.

Cell 2: Name block
- File icon (20x20 container) + name/owner stacked text.
- File name ellipsis logic:
  - Base name truncates with ellipsis.
  - Extension remains visible separately.
- Optional owner line shown when:
  - current tab is `shared`, OR
  - `file.shared === true`
- Owner text format:
  - `Shared by <owner>`
  - fallback `Shared with you`

Cell 3: Type
- Type label from `getFileTypePresentation(file.name, file.mime_type)`.

Cell 4: Size
- Formatted via `formatFileSize(file.size_bytes)`.

Cell 5: Updated
- Formatted via `formatDateCompact(file.modified_at)`.

Cell 6: Right-side pill
- If too large -> `Too large` danger pill.
- Else if shared -> `Shared` neutral pill.
- Else empty placeholder span.

Pill styles:
- Shared: soft border + subtle bg + fw600 + full pill radius.
- Too large: danger border + danger bg + danger text + fw700 + full pill radius.

### 8.4 Empty state

When no files:
- Dashed border block (`1px dashed var(--border-soft)`)
- Radius `8px`, centered text
- Heading `No files found`
- Caption `Try another query or switch tab.`

## 9) Footer area

Footer (`import-file-dialog__drive-browser-footer`):
- Top border `1px solid var(--separator-muted)`
- Top padding `12px`
- Docked to bottom via `margin-top:auto`

Left side text:
- If batch size exceeded -> red warning text from `getImportBatchTooLargeMessage()`
- Else:
  - `<N> selected` if selection exists
  - `Select one or more files to import.` otherwise

Right side actions:
- `Clear` (default variant, size xs)
  - Disabled if no importable selection or import in progress
  - Clears all selected ids
- `Import selected` (filled, size xs)
  - Disabled if no selection or batch too large
  - Shows loading during mutation

## 10) Import/selection logic that affects UI

Selection and filtering details:
- Internal selected ids can contain stale ids, but effective selection is filtered by currently visible file ids.
- Non-importable files (`size > MAX_IMPORT_FILE_SIZE_BYTES`) are excluded from effective import selection.
- Visual selected state for rows is computed only from importable effective set.

Limits:
- Per-file max: `MAX_IMPORT_FILE_SIZE_BYTES` from env.
  - Default fallback: `4 * 1024 * 1024` (4 MB).
- Per-batch max: fixed `30 * 1024 * 1024` (30 MB).

Import flow:
- Sequential import per selected id.
- On completion modal closes before notifications/partial handler.
- Notifications:
  - success all
  - generic or server message failures
  - partial result callback path when configured.

## 11) Accessibility/interaction baseline

Keyboard and semantics:
- Selectable row has `role='checkbox'`, `aria-checked`, key handling for `Enter` and `Space`.
- Too-large rows are not tabbable and marked `aria-disabled`.
- Checkbox itself has `ariaLabel="Select <file>"`.

Focus behavior:
- Search receives focus on open (import mode only).
- Close button focus ring is globally styled, then local class disables additional outline for this dialog close element.

## 12) Responsive behavior

Breakpoint: `@media (max-width: 860px)`

Changes:
- Header title group shifts to column alignment.
- Status email max width shrinks (`min(54vw, 240px)`).
- Toolbar becomes vertical stack.
- Tabs/sort align to left.
- Grid columns become:
  - `28px minmax(0, 1.7fr) minmax(100px, 1fr) 84px 112px 76px`

## 13) Theme tokens used by dialog (actual values)

The dialog relies heavily on semantic tokens. Important values:

- `--bg-surface`: light `#ffffff`, dark `#141c28`
- `--bg-subtle`: light `#f8f9fb`, dark `#1a2433`
- `--bg-hover-soft`: light `#eef2f8`, dark `#1f2a3b`
- `--border-soft`: light `#dde1e7`, dark `#2a394b`
- `--border-muted`: light `#d4deec`, dark `#32445a`
- `--separator-soft`: light `#e7ebf2`, dark `#28384c`
- `--separator-muted`: light `#dde5f0`, dark `#2c3a4d`
- `--text-primary`: light `#1f2430`, dark `#e4ebf6`
- `--text-secondary`: light `#5a6272`, dark `#b0bfd2`
- `--text-muted`: light `#6d7588`, dark `#8e9fb8`
- `--accent`: light `#2f6fed`, dark `#5b8fff`
- `--state-danger-bg`: light `#fff1f1`, dark `#3a2228`
- `--state-danger-bg-soft`: light `#fff5f5`, dark `#342027`
- `--state-danger-border`: light `#ffd8d8`, dark `#6c3a45`
- `--state-danger-text`: light `#c43636`, dark `#ff9ca5`

Screenshot context provided by user matches dark theme token branch.

## 14) Dead/legacy CSS selectors currently present

In `import-file-dialog.css`, the following selectors are defined but not used by current JSX:
- `.import-file-dialog__connect-logo`
- `.import-file-dialog__upload-dropzone`
- `.import-file-dialog__upload-dropzone--active`
- `.import-file-dialog__upload-icon`
- `.import-file-dialog__choose-button`
- `.import-file-dialog__upload-limit`
- `.import-file-dialog__hidden-input`
- media selector `.import-file-dialog__header-actions`

This likely comes from an earlier mixed local-upload + Google-import design.

## 15) Visual checksum (quick manual)

Expected visual signature (dark mode):
- Centered modal with muted-blue dark surface, subtle border, blurred dark overlay.
- Header with title at left and rounded connection chip at right.
- First row controls: search, source tabs, sort group with vertical separator.
- Bordered scroll table with sticky header and compact rows.
- Selected rows have subtle highlight; oversized rows are tinted red and non-selectable.
- Right column pills: `Shared` neutral, `Too large` red.
- Footer shows selection status and `Clear` + `Import selected` actions.

If any of these change after Tailwind migration, that is a visual regression unless explicitly accepted.

