const isMacLikePlatform = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false
  }

  const userAgentData = navigator.userAgentData as { platform?: string } | undefined
  const reportedPlatform = userAgentData?.platform ?? navigator.platform ?? ''
  return reportedPlatform.toLowerCase().includes('mac')
}

const primaryModifierLabel = isMacLikePlatform() ? 'Cmd' : 'Ctrl'

export const APP_SHORTCUTS = {
  openSearch: {
    code: 'KeyF',
    label: `${primaryModifierLabel} + Alt + F`,
    compactLabel: `${primaryModifierLabel}+Alt+F`,
  },
  createFolder: {
    code: 'KeyN',
    label: `${primaryModifierLabel} + Alt + N`,
    compactLabel: `${primaryModifierLabel}+Alt+N`,
  },
  importFromComputer: {
    code: 'KeyU',
    label: `${primaryModifierLabel} + Alt + U`,
    compactLabel: `${primaryModifierLabel}+Alt+U`,
  },
  importFromGoogle: {
    code: 'KeyG',
    label: `${primaryModifierLabel} + Alt + G`,
    compactLabel: `${primaryModifierLabel}+Alt+G`,
  },
  selectAll: {
    code: 'KeyA',
    label: `${primaryModifierLabel} + Alt + A`,
    compactLabel: `${primaryModifierLabel}+Alt+A`,
  },
  openShortcutsHelp: {
    code: 'Slash',
    label: `${primaryModifierLabel} + Alt + /`,
    compactLabel: `${primaryModifierLabel}+Alt+/`,
  },
} as const

export const withShortcutHint = (label: string, shortcut: string): string => `${label} (${shortcut})`
