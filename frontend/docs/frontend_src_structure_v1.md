# Frontend `src/` Structure Blueprint v1

Этот документ — **практический стартовый каркас** для frontend-приложения Data Room.

Цель структуры:
- сохранить чистую, расширяемую архитектуру;
- не допускать циклических зависимостей;
- не раздувать файлы и модули;
- разделить код по ответственности;
- позволить без боли добавить папки, copy/move, local upload, search, grid view, favorites.

---

## 1. Главный принцип

Структура строится по слоям:

- `app` — инициализация приложения, роутинг, провайдеры, глобальные стили;
- `pages` — страницы как композиция widgets;
- `widgets` — большие независимые части экрана;
- `features` — пользовательские действия / use cases;
- `entities` — доменные сущности и их UI-представления;
- `shared` — переиспользуемая инфраструктура.

Зависимости только сверху вниз:

```text
app -> pages -> widgets -> features -> entities -> shared
```

Запрещено:
- `entities` импортировать `features`;
- `features` импортировать `widgets`;
- `shared` импортировать что-либо из верхних слоев;
- cross-import между соседними фичами напрямую, если можно вынести контракт в `entities` или `shared`.

---

## 2. Базовое дерево `src/`

```text
src/
  app/
    providers/
      router/
        index.ts
        router.tsx
      query/
        index.ts
        query-client.ts
      auth/
        index.ts
        auth-provider.tsx
      theme/
        index.ts
        theme-provider.tsx
    styles/
      globals.css
      tokens.css
    App.tsx
    main.tsx

  pages/
    dataroom-page/
      index.ts
      ui/
        dataroom-page.tsx

  widgets/
    app-shell/
      index.ts
      ui/
        app-shell.tsx
        shell-header.tsx
        shell-body.tsx
    dataroom-sidebar/
      index.ts
      ui/
        dataroom-sidebar.tsx
        sidebar-section.tsx
      model/
        use-sidebar-tree.ts
    dataroom-toolbar/
      index.ts
      ui/
        dataroom-toolbar.tsx
        toolbar-actions.tsx
    breadcrumbs-bar/
      index.ts
      ui/
        breadcrumbs-bar.tsx
        collapsed-crumbs-menu.tsx
    content-pane/
      index.ts
      ui/
        content-pane.tsx
        content-empty-state.tsx
        content-error-state.tsx
    file-table/
      index.ts
      ui/
        file-table.tsx
        file-table-header.tsx
        file-table-row.tsx
        file-kind-icon.tsx
        sort-indicator.tsx
    bulk-actions-bar/
      index.ts
      ui/
        bulk-actions-bar.tsx
    preview-pane/
      index.ts
      ui/
        preview-pane.tsx
        preview-empty-state.tsx
        preview-loading-state.tsx
        preview-error-state.tsx
        preview-unsupported-state.tsx
        resize-handle.tsx
    google-connection-panel/
      index.ts
      ui/
        google-connection-panel.tsx
    import-file-dialog/
      index.ts
      ui/
        import-file-dialog.tsx
        import-source-picker.tsx

  features/
    auth-by-firebase/
      index.ts
      model/
        use-auth-session.ts
        auth-guards.ts
      api/
        verify-session.ts
    load-current-user/
      index.ts
      api/
        get-current-user.ts
      model/
        use-current-user-query.ts
    connect-google-drive/
      index.ts
      api/
        get-google-connect-url.ts
      model/
        use-google-connect.ts
    disconnect-google-drive/
      index.ts
      api/
        disconnect-google-drive.ts
      model/
        use-google-disconnect.ts
    check-google-status/
      index.ts
      api/
        get-google-status.ts
      model/
        use-google-status-query.ts
    browse-google-files/
      index.ts
      api/
        get-google-files.ts
      model/
        use-google-files-query.ts
    import-file-from-google/
      index.ts
      api/
        import-file-from-google.ts
      model/
        use-import-file-from-google.ts
    upload-file-from-device/
      index.ts
      api/
        upload-file-from-device.ts
      model/
        use-upload-file-from-device.ts
      ui/
        device-upload-dropzone.tsx
        device-upload-button.tsx
    create-folder/
      index.ts
      api/
        create-folder.ts
      model/
        use-create-folder.ts
      ui/
        create-folder-dialog.tsx
    open-folder/
      index.ts
      model/
        use-open-folder.ts
    open-file-preview/
      index.ts
      model/
        use-open-file-preview.ts
    close-file-preview/
      index.ts
      model/
        use-close-file-preview.ts
    sort-content-items/
      index.ts
      model/
        sorting.ts
        use-sort-state.ts
    select-content-items/
      index.ts
      model/
        selection-store.ts
        use-selection-actions.ts
    copy-content-items/
      index.ts
      model/
        clipboard-store.ts
        use-copy-content-items.ts
    paste-content-items/
      index.ts
      api/
        paste-content-items.ts
      model/
        use-paste-content-items.ts
    move-content-items/
      index.ts
      api/
        move-content-items.ts
      model/
        use-move-content-items.ts
      ui/
        move-items-dialog.tsx
    delete-content-items/
      index.ts
      api/
        delete-content-items.ts
      model/
        use-delete-content-items.ts
      ui/
        delete-items-dialog.tsx
    drag-and-drop-items/
      index.ts
      model/
        drag-store.ts
        use-drag-and-drop-items.ts
    navigate-by-breadcrumbs/
      index.ts
      model/
        use-breadcrumb-navigation.ts

  entities/
    user/
      index.ts
      model/
        types.ts
        selectors.ts
    google-drive-connection/
      index.ts
      model/
        types.ts
        selectors.ts
    folder/
      index.ts
      model/
        types.ts
        mappers.ts
        selectors.ts
      ui/
        folder-badge.tsx
        folder-icon.tsx
    file/
      index.ts
      model/
        types.ts
        mappers.ts
        selectors.ts
      ui/
        file-badge.tsx
        file-icon.tsx
    content-item/
      index.ts
      model/
        types.ts
        guards.ts
        mappers.ts
        sort.ts
        tree.ts
        breadcrumbs.ts
      ui/
        item-name-cell.tsx
        item-meta-cell.tsx

  shared/
    api/
      client.ts
      types.ts
      errors.ts
      auth-header.ts
    config/
      env.ts
      routes.ts
    lib/
      date/
        format-date.ts
      file/
        format-file-size.ts
        get-file-extension.ts
        is-previewable-file.ts
      naming/
        make-copy-name.ts
        resolve-duplicate-name.ts
      keyboard/
        hotkeys.ts
      browser/
        download-file.ts
        open-blob-url.ts
      tree/
        flatten-tree.ts
        build-tree.ts
      guards/
        is-not-null.ts
    hooks/
      use-debounce.ts
      use-disclosure.ts
      use-resizable-panel.ts
      use-hotkeys.ts
      use-click-outside.ts
    ui/
      button/
        button.tsx
      checkbox/
        checkbox.tsx
      dialog/
        dialog.tsx
      dropdown/
        dropdown.tsx
      input/
        input.tsx
      table/
        table.tsx
      empty-state/
        empty-state.tsx
      error-state/
        error-state.tsx
      loader/
        loader.tsx
      toast/
        toast.tsx
      tooltip/
        tooltip.tsx
      scroll-area/
        scroll-area.tsx
      resizable/
        resizable.tsx
    model/
      app-store.ts
      route-state.ts
    types/
      common.ts
      branded.ts
```

---

## 3. Что лежит в каждом слое

## `app/`

Только код запуска приложения.

Что сюда класть:
- React root;
- router;
- QueryClientProvider;
- AuthProvider;
- ThemeProvider;
- глобальные стили.

Что не класть:
- бизнес-логику Data Room;
- file/folder selection;
- import flows;
- локальные доменные типы.

### Пример
- `main.tsx` — точка входа;
- `App.tsx` — корневая композиция;
- `providers/router/router.tsx` — дерево роутов.

---

## `pages/`

Страница — это композиционный слой. Она знает, **какие widgets собрать на экране**, но не реализует внутри себя предметную логику.

Для v1 достаточно одной страницы:
- `dataroom-page`

В ней не должно быть:
- длинных `useEffect`;
- прямых fetch-запросов;
- ручной бизнес-логики copy/move/import.

---

## `widgets/`

Widgets — это **крупные области интерфейса**.

Условия для widget:
- он может использовать несколько features;
- он не должен реализовывать доменные правила внутри себя;
- его задача — собрать готовое поведение и UI.

### Примеры widgets

#### `dataroom-sidebar`
Отвечает за:
- рендер дерева папок;
- выбор текущей папки;
- отображение корня `Data Room`;
- будущие favorites.

Не отвечает за:
- импорт файла;
- copy/paste;
- file preview.

#### `dataroom-toolbar`
Отвечает за:
- глобальные действия shell уровня;
- `New folder`;
- `Import file`.

#### `file-table`
Отвечает за:
- отображение содержимого текущей папки в tabular view;
- колонки;
- строки;
- иконки;
- sort headers.

Не отвечает за:
- получение данных;
- selection store;
- preview state;
- move/copy business logic.

#### `preview-pane`
Отвечает за:
- отображение preview справа;
- resizable panel;
- loading/error/unsupported states.

Не отвечает за:
- изменение route;
- выбор файла из списка.

---

## `features/`

Это **основной слой use case-логики**.

Каждая feature должна отвечать **за одно действие пользователя**.

Хороший признак feature:
- можно назвать глаголом;
- у неё есть вход, эффект и результат;
- её можно переиспользовать в разных widgets.

### Примеры
- `connect-google-drive`
- `import-file-from-google`
- `create-folder`
- `delete-content-items`
- `sort-content-items`
- `open-file-preview`

### Рекомендуемая структура feature

```text
feature-name/
  index.ts
  api/
  model/
  ui/        # только если feature имеет собственный кусок UI
```

### Правило
Если feature превращается в “комбайн на 500 строк”, значит она делает слишком много.

Нужно дробить:
- `delete-content-items`
- `move-content-items`
- `copy-content-items`

вместо одного монстра:
- `manage-content-items`

---

## `entities/`

Entities — это доменная модель.

Здесь живут:
- типы сущностей;
- pure helpers;
- селекторы;
- минимальные UI-компоненты, специфичные для сущности.

### Сущности в нашем приложении
- `user`
- `google-drive-connection`
- `folder`
- `file`
- `content-item` — объединяющая сущность для списка

### Почему нужен `content-item`
Потому что в UI у нас часто будет не отдельно “массив файлов” и “массив папок”, а **единый список элементов текущей папки**.

`content-item` должен содержать:
- discriminated union `kind: 'file' | 'folder'`;
- shared поля для таблицы;
- utilities для сортировки;
- utilities для breadcrumbs и tree mapping.

---

## `shared/`

Только техническое переиспользование.

Сюда можно:
- API client;
- общие UI primitives;
- утилиты;
- generic hooks;
- env config.

Сюда нельзя:
- `file selection state`;
- `folder business rules`;
- anything Data Room specific, если это не truly generic.

Пример плохого shared-кода:
- `shared/lib/delete-selected-files.ts`

Почему плохо:
- это уже доменная логика, а не generic helper.

---

## 4. Роутинг

Предлагаемый роутинг:

```text
/dataroom
/dataroom/f/:folderId
/dataroom/f/:folderId?preview=:fileId
```

### Где что хранится
- `folderId` — в path params;
- `preview` — в query param;
- `sortBy`, `sortOrder` можно позже добавить в query params;
- `searchQuery` — тоже позже через query params.

### Кто работает с route
- `app/providers/router`
- feature-уровень хуков навигации
- page/widget-композиция

Нельзя:
- парсить URL вручную в 10 местах;
- дублировать route state в локальном `useState`, если он уже есть в URL.

---

## 5. Состояние приложения

Нужно разделять state по типу.

## 5.1 Server state

Хранить через React Query:
- current user;
- google connection status;
- список файлов Google Drive;
- список элементов текущей папки;
- metadata preview item.

## 5.2 Route state

Через router:
- current folder;
- opened preview file;
- позже sort/search params.

## 5.3 Interaction state

Локально или в лёгком store:
- selection;
- drag state;
- clipboard state;
- dialog visibility;
- preview panel width.

### Важно
Не надо складывать всё в один глобальный Zustand-store.

Лучше:
- selection store отдельно;
- clipboard store отдельно;
- drag store отдельно;
- dialogs локально рядом с feature/widget.

---

## 6. Правила для размеров модулей

## Компоненты
Рекомендуемая граница:
- до ~150 строк — комфортно;
- 150–250 — терпимо, если это purely presentational container;
- 250+ — проверить, не нарушена ли SRP.

## Hooks / feature model
- до ~120 строк — комфортно;
- если больше — выносить pure helpers в `lib`/`model`.

## API-файлы
Один файл = один запрос.

Пример:
- `get-google-status.ts`
- `get-google-files.ts`
- `import-file-from-google.ts`

А не один:
- `google-api.ts` на 600 строк.

---

## 7. Public API модулей

У каждого модуля должен быть `index.ts`.

Он экспортирует только то, что допустимо использовать снаружи.

### Пример

```ts
export { FileTable } from './ui/file-table';
```

Не надо экспортировать наружу внутренние helpers модуля “на всякий случай”.

### Зачем это нужно
- скрывает внутренности;
- уменьшает связанность;
- помогает не создавать неявные зависимости;
- облегчает рефакторинг.

---

## 8. Пример разбиения по ответственности

## Открытие файла в preview

### Кто за что отвечает
- `file-table-row.tsx` — вызывает `onOpen(item.id)`;
- `open-file-preview` feature — меняет route query param `preview`;
- `preview-pane` widget — читает active preview id и рендерит содержимое;
- `shared/lib/file/is-previewable-file.ts` — pure helper;
- `api/files/{id}/content` вызывается через отдельный feature/api слой.

### Чего нельзя делать
- чтобы `file-table-row` сам ходил в API;
- чтобы `preview-pane` сам менял route напрямую и ещё обновлял selection;
- чтобы вся логика жила в `pages/dataroom-page.tsx`.

---

## 9. Пример разбиения для import flow

## `Import file`

### Shell уровень
- widget `dataroom-toolbar` показывает кнопку `Import file`
- widget `import-file-dialog` открывает выбор источника

### Дальше 2 независимые ветки
- `import-file-from-google`
- `upload-file-from-device`

Это важно: local upload и Google import не должны быть одной огромной feature с кучей `if (source === ...)`.

Можно иметь общий widget-слой диалога, но use case должны остаться раздельными.

---

## 10. Соглашение для именования

### Компоненты
- PascalCase в экспортах
- файлы — kebab-case

Пример:
- файл: `file-table-row.tsx`
- экспорт: `FileTableRow`

### Hooks
- `use-*`

### Stores
- `*-store.ts`

### Query hooks
- `use-*-query.ts`

### Mutation hooks
- `use-*.ts`

### Helpers
- глагол + объект

Пример:
- `format-file-size.ts`
- `resolve-duplicate-name.ts`
- `build-tree.ts`

---

## 11. Как не допускать циклические зависимости

## Правило 1
Никогда не импортировать модуль через глубокий путь из соседнего слоя, если у него есть `index.ts`.

Хорошо:
```ts
import { FileTable } from '@/widgets/file-table';
```

Плохо:
```ts
import { FileTableRow } from '@/widgets/file-table/ui/file-table-row';
```

## Правило 2
Entity не должна знать о feature.

## Правило 3
Feature не должна знать о widget.

## Правило 4
Если 2 фичи начали импортировать друг друга — вынести общее:
- либо в `entities`
- либо в `shared`
- либо создать третью orchestrating feature

## Правило 5
Запустить статические проверки:
- ESLint `import/no-cycle`
- ESLint `import/no-internal-modules`
- dependency-cruiser
- TypeScript path aliases

---

## 12. Рекомендуемые path aliases

```json
{
  "compilerOptions": {
    "baseUrl": "src",
    "paths": {
      "@/*": ["*"],
      "@/app/*": ["app/*"],
      "@/pages/*": ["pages/*"],
      "@/widgets/*": ["widgets/*"],
      "@/features/*": ["features/*"],
      "@/entities/*": ["entities/*"],
      "@/shared/*": ["shared/*"]
    }
  }
}
```

---

## 13. Что можно упростить в самом начале

Чтобы не перезадизайнить проект слишком рано, на первом шаге можно **не создавать все папки физически сразу**.

Стартовый минимальный набор:

```text
src/
  app/
  pages/
  widgets/
  features/
  entities/
  shared/
```

И внутри создать только то, что реально нужно для первого рабочего вертикального среза:
- `app`
- `pages/dataroom-page`
- `widgets/app-shell`
- `widgets/dataroom-toolbar`
- `widgets/file-table`
- `widgets/preview-pane`
- `features/load-current-user`
- `features/check-google-status`
- `features/import-file-from-google`
- `features/select-content-items`
- `features/open-file-preview`
- `entities/file`
- `entities/content-item`
- `shared/api`
- `shared/ui`

То есть архитектура должна быть **готовой к росту**, но кодовая база не обязана сразу содержать 100 пустых файлов.

---

## 14. Первый вертикальный срез, который стоит реализовать первым

1. Поднять shell страницы
2. Получить current user
3. Получить google status
4. Показать toolbar
5. Показать table с items
6. Открывать preview справа
7. Сделать selection через checkbox
8. Сделать import from Google

Это даст рабочий end-to-end скелет без premature overengineering.

---

## 15. Итог

Если кратко, то стартовая архитектура должна соблюдать 5 правил:

1. **Слои только вниз по зависимостям**
2. **Одна feature = одно действие пользователя**
3. **Entities не знают о features**
4. **Widgets собирают поведение, но не владеют бизнес-логикой**
5. **Public API через `index.ts`, без глубоких импортов**

Этого уже достаточно, чтобы проект:
- не расползся в giant components;
- не начал плодить циклы;
- сохранил читаемость;
- остался расширяемым для следующих фич.
