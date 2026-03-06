export const messages = {
  appTitle: 'Data Room',
  signInTitle: 'Sign in to Data Room',
  signInWithGoogle: 'Sign in with Google',
  connecting: 'Connecting...',
  importFile: 'Import file',
  newFolder: 'New folder',
  newFolderSoon: 'Create folder will be enabled in the next iteration.',
  selectedCount: 'Selected',
  clearSelection: 'Clear selection',
  copy: 'Copy',
  move: 'Move',
  delete: 'Delete',
  loading: 'Loading...',
  emptyFolder: 'This folder is empty.',
  previewEmpty: 'Select a file to preview.',
  previewUnsupported: 'Preview is not available for this file type.',
  previewMissing: 'File content is missing on server.',
  previewOpenNewTab: 'Open in new tab',
  previewDownload: 'Download',
  googleNotConnected: 'Google Drive is not connected.',
  googleReconnectRequired: 'Google reconnect is required.',
  connectGoogle: 'Connect Google Drive',
  importFromGoogle: 'Import from Google Drive',
  uploadFromComputer: 'Upload from computer',
  uploadComingSoon: 'Local upload UI is scheduled for the next iteration.',
  oauthSuccess: 'Google account connected successfully.',
  oauthError: 'Google connection failed.',
} as const

export type MessageKey = keyof typeof messages

export const t = (key: MessageKey): string => messages[key]
