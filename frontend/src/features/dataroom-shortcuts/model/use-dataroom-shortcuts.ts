import { useEffect } from 'react'

import { isEditableEventTarget } from '@/shared/lib/keyboard/is-editable-event-target'
import { APP_SHORTCUTS } from '@/shared/lib/keyboard/shortcuts'

type DataroomShortcutActions = {
  onOpenSearch: () => void
  onCreateFolder: () => void
  onImportFromComputer: () => void
  onImportFromGoogle: () => void
  onSelectAll: () => void
  onOpenSelected: () => void
  onOpenParentFolder: () => void
  onDeleteSelected: () => void
  onRenameSelected: () => void
  onQuickPreview: () => void
  onEscape: () => void
  onOpenShortcutsHelp: () => void
}

type UseDataroomShortcutsParams = DataroomShortcutActions & {
  suspended?: boolean
}

const isModifierPressed = (event: KeyboardEvent): boolean => event.metaKey || event.ctrlKey

export const useDataroomShortcuts = ({
  suspended = false,
  onOpenSearch,
  onCreateFolder,
  onImportFromComputer,
  onImportFromGoogle,
  onSelectAll,
  onOpenSelected,
  onOpenParentFolder,
  onDeleteSelected,
  onRenameSelected,
  onQuickPreview,
  onEscape,
  onOpenShortcutsHelp,
}: UseDataroomShortcutsParams) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      const key = event.key
      const code = event.code
      const isModifier = isModifierPressed(event)
      const isEditableTarget = isEditableEventTarget(event.target)
      const isAppModifier = isModifier && event.altKey
      const isOpenSearchShortcut = isAppModifier && !event.shiftKey && code === APP_SHORTCUTS.openSearch.code
      const isCreateFolderShortcut = isAppModifier && !event.shiftKey && code === APP_SHORTCUTS.createFolder.code
      const isImportFromComputerShortcut =
        isAppModifier && !event.shiftKey && code === APP_SHORTCUTS.importFromComputer.code
      const isImportFromGoogleShortcut =
        isAppModifier && !event.shiftKey && code === APP_SHORTCUTS.importFromGoogle.code
      const isSelectAllShortcut = isAppModifier && !event.shiftKey && code === APP_SHORTCUTS.selectAll.code
      const isOpenShortcutsHelpShortcut =
        isAppModifier && !event.shiftKey && code === APP_SHORTCUTS.openShortcutsHelp.code

      if (isOpenSearchShortcut) {
        event.preventDefault()
        if (!suspended) {
          onOpenSearch()
        }
        return
      }

      if (isCreateFolderShortcut) {
        event.preventDefault()
        if (!suspended) {
          onCreateFolder()
        }
        return
      }

      if (isImportFromComputerShortcut) {
        event.preventDefault()
        if (!suspended) {
          onImportFromComputer()
        }
        return
      }

      if (isImportFromGoogleShortcut) {
        event.preventDefault()
        if (!suspended) {
          onImportFromGoogle()
        }
        return
      }

      if (isSelectAllShortcut) {
        if (isEditableTarget) {
          return
        }
        event.preventDefault()
        if (!suspended) {
          onSelectAll()
        }
        return
      }

      if (isOpenShortcutsHelpShortcut) {
        event.preventDefault()
        if (!suspended) {
          onOpenShortcutsHelp()
        }
        return
      }

      if (isEditableTarget) {
        return
      }

      if (suspended) {
        return
      }

      if (key === 'Escape') {
        event.preventDefault()
        onEscape()
        return
      }

      if (key === 'Enter') {
        event.preventDefault()
        onOpenSelected()
        return
      }

      if (key === 'Backspace' || (event.altKey && key === 'ArrowLeft')) {
        event.preventDefault()
        onOpenParentFolder()
        return
      }

      if (key === 'Delete' || (event.metaKey && key === 'Backspace')) {
        event.preventDefault()
        onDeleteSelected()
        return
      }

      if (key === 'F2') {
        event.preventDefault()
        onRenameSelected()
        return
      }

      if (key === ' ') {
        event.preventDefault()
        onQuickPreview()
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [
    suspended,
    onOpenSearch,
    onCreateFolder,
    onImportFromComputer,
    onImportFromGoogle,
    onSelectAll,
    onOpenSelected,
    onOpenParentFolder,
    onDeleteSelected,
    onRenameSelected,
    onQuickPreview,
    onEscape,
    onOpenShortcutsHelp,
  ])
}
