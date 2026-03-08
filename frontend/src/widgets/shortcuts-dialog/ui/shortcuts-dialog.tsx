import { Modal, Text } from '@/shared/ui'
import { APP_SHORTCUTS } from '@/shared/lib/keyboard/shortcuts'

import './shortcuts-dialog.css'

type ShortcutsDialogProps = {
  opened: boolean
  onClose: () => void
}

const shortcuts = [
  { keys: APP_SHORTCUTS.openSearch.label, description: 'Open search' },
  { keys: APP_SHORTCUTS.createFolder.label, description: 'Create folder' },
  { keys: APP_SHORTCUTS.importFromComputer.label, description: 'Upload from computer' },
  { keys: APP_SHORTCUTS.importFromGoogle.label, description: 'Import from Google Drive' },
  { keys: 'Shift + Click', description: 'Select range in table' },
  { keys: APP_SHORTCUTS.selectAll.label, description: 'Select all items in current folder' },
  { keys: 'Enter', description: 'Open selected item' },
  { keys: 'Backspace or Alt + Left', description: 'Open parent folder' },
  { keys: 'Delete or Cmd + Backspace', description: 'Delete selected items' },
  { keys: 'F2', description: 'Rename selected item' },
  { keys: 'Space', description: 'Quick preview selected file' },
  { keys: 'Esc', description: 'Close dialog or clear selection' },
  { keys: APP_SHORTCUTS.openShortcutsHelp.label, description: 'Open shortcuts help' },
]

export const ShortcutsDialog = ({ opened, onClose }: ShortcutsDialogProps) => (
  <Modal opened={opened} onClose={onClose} title="Keyboard shortcuts" centered size="md">
    <Text size="sm" c="dimmed" mb="sm">
      Shortcuts are active in Data Room and ignored while typing in input fields.
    </Text>
    <table className="shortcuts-dialog__table">
      <thead>
        <tr>
          <th>Shortcut</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {shortcuts.map((shortcut) => (
          <tr key={shortcut.keys}>
            <td className="shortcuts-dialog__keys">{shortcut.keys}</td>
            <td>{shortcut.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Modal>
)
