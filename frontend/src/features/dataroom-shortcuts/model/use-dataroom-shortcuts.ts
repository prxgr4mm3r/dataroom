import { useEffect } from 'react'

import { isEditableEventTarget } from '@/shared/lib/keyboard/is-editable-event-target'

type DataroomShortcutActions = {
  onOpenSearch: () => void
  onCreateFolder: () => void
  onImportFromComputer: () => void
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

      if (suspended) {
        return
      }

      const isEditableTarget = isEditableEventTarget(event.target)
      const key = event.key
      const isModifier = isModifierPressed(event)

      if (isEditableTarget) {
        return
      }

      if (key === 'Escape') {
        event.preventDefault()
        onEscape()
        return
      }

      if (isModifier && !event.shiftKey && key.toLowerCase() === 'f') {
        event.preventDefault()
        onOpenSearch()
        return
      }

      if (isModifier && event.shiftKey && key.toLowerCase() === 'n') {
        event.preventDefault()
        onCreateFolder()
        return
      }

      if (isModifier && !event.shiftKey && key.toLowerCase() === 'i') {
        event.preventDefault()
        onImportFromComputer()
        return
      }

      if (isModifier && !event.shiftKey && key.toLowerCase() === 'a') {
        event.preventDefault()
        onSelectAll()
        return
      }

      if (isModifier && !event.shiftKey && key === '/') {
        event.preventDefault()
        onOpenShortcutsHelp()
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

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    suspended,
    onOpenSearch,
    onCreateFolder,
    onImportFromComputer,
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
