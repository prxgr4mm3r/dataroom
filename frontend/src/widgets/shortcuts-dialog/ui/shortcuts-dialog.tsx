import { Modal, Text } from '@/shared/ui'
import { APP_SHORTCUTS } from '@/shared/lib/keyboard/shortcuts'

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
  <Modal
    opened={opened}
    onClose={onClose}
    title="Keyboard shortcuts"
    centered
    size="md"
    styles={{
      header: {
        padding: '10px 14px',
        minHeight: 0,
      },
      body: {
        paddingTop: '18px',
      },
      title: {
        fontSize: '0.95rem',
      },
    }}
  >
    <Text size="sm" c="dimmed" mb="sm">
      Shortcuts are active in Data Room and ignored while typing in input fields.
    </Text>
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="border-b border-[var(--separator-soft)] py-2 text-left align-top text-xs font-bold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Shortcut
          </th>
          <th className="border-b border-[var(--separator-soft)] py-2 text-left align-top text-xs font-bold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Action
          </th>
        </tr>
      </thead>
      <tbody>
        {shortcuts.map((shortcut) => (
          <tr key={shortcut.keys}>
            <td className="border-b border-[var(--separator-soft)] py-2 text-left align-top font-mono text-[13px] whitespace-nowrap text-[var(--accent)]">
              {shortcut.keys}
            </td>
            <td className="border-b border-[var(--separator-soft)] py-2 text-left align-top text-sm">{shortcut.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Modal>
)
