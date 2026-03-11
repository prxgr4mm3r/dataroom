import {
  IconCopy,
  IconLink,
  IconLinkOff,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import type { ContentItem } from '@/entities/content-item'
import { useCreateShareLink, useRevokeShareLink, useShareLinksQuery } from '@/features/share-links'
import { toApiError } from '@/shared/api'
import { formatDate, formatDateCompact } from '@/shared/lib/date/format-date'
import {
  Alert,
  ActionIcon,
  Box,
  Button,
  Loader,
  Modal,
  Stack,
  Text,
} from '@/shared/ui'
import { notifyError, notifySuccess } from '@/shared/ui'

type ShareLinksDialogProps = {
  opened: boolean
  item: ContentItem | null
  onClose: () => void
}

const copyText = async (value: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export const ShareLinksDialog = ({ opened, item, onClose }: ShareLinksDialogProps) => {
  const itemId = item?.id ?? null
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false)

  const linksQuery = useShareLinksQuery(itemId, opened)
  const createLinkMutation = useCreateShareLink()
  const revokeLinkMutation = useRevokeShareLink()

  const links = linksQuery.data ?? []
  const link = links[0] ?? null
  const hasLink = Boolean(link)
  const pendingRevoke = revokeLinkMutation.isPending
  const showLinkState = !linksQuery.isPending && Boolean(link)

  useEffect(() => {
    if (!opened) {
      setAutoCreateAttempted(false)
      return
    }
    setAutoCreateAttempted(false)
  }, [itemId, opened])

  useEffect(() => {
    if (!opened || !itemId || linksQuery.isPending || linksQuery.error) {
      return
    }
    if (createLinkMutation.isPending || autoCreateAttempted) {
      return
    }

    setAutoCreateAttempted(true)
    createLinkMutation
      .mutateAsync({ itemId })
      .then(() => {
        notifySuccess('Share link is ready.')
      })
      .catch((error) => {
        notifyError(toApiError(error).message)
      })
  }, [autoCreateAttempted, createLinkMutation, itemId, linksQuery.error, linksQuery.isPending, opened])

  const copyLink = async (shareUrl: string | null) => {
    if (!shareUrl) {
      notifyError('Cannot copy this link yet. Reopen the dialog and try again.')
      return
    }

    setCopyingId(link?.id ?? 'share-link')
    try {
      await copyText(shareUrl)
      notifySuccess('Share link copied.')
    } catch {
      notifyError('Failed to copy share link.')
    } finally {
      setCopyingId(null)
    }
  }

  const revokeLink = async (shareId: string) => {
    if (!itemId) {
      return
    }
    try {
      await revokeLinkMutation.mutateAsync({ shareId, itemId })
      notifySuccess('Share link revoked.')
    } catch (error) {
      notifyError(toApiError(error).message)
    }
  }

  const closeButton = (
    <ActionIcon
      variant="transparent"
      onClick={onClose}
      aria-label="Close share dialog"
      className="h-8 w-8 shrink-0 rounded-xl border-0 bg-transparent text-[var(--accent)] transition-colors duration-[120ms] ease-[ease] hover:!bg-[var(--accent-soft)] hover:!text-[var(--accent-hover)]"
    >
      <IconX size={18} />
    </ActionIcon>
  )

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={null}
      withCloseButton={false}
      centered
      size="md"
      styles={{
        content: {
          background: 'transparent',
          border: 0,
          boxShadow: 'none',
          outline: 'none',
        },
        body: {
          padding: 0,
          background: 'transparent',
        },
      }}
    >
      <Stack gap="2" className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3.5 py-3">
        {showLinkState && link ? (
          <Box className="flex min-h-8 items-center justify-between gap-2">
            <Text
              size="xs"
              fw={600}
              className="inline-flex min-w-0 items-center gap-1.5 leading-5"
              style={{ color: 'var(--accent)' }}
            >
              <IconLink size={12} />
              Read-only
              {link.expires_at ? ` • Expires ${formatDateCompact(link.expires_at)}` : ' • No expiry'}
            </Text>
            {closeButton}
          </Box>
        ) : (
          <Box className="flex min-h-8 items-center justify-end">{closeButton}</Box>
        )}

        {linksQuery.error ? (
          <Alert color="red" title="Failed to load share links">
            {toApiError(linksQuery.error).message}
          </Alert>
        ) : null}

        {linksQuery.isPending || createLinkMutation.isPending ? (
          <Box className="inline-flex items-center gap-2.5 py-1 text-[var(--text-secondary)]">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Preparing share link...
            </Text>
          </Box>
        ) : null}

        {!linksQuery.isPending && !hasLink ? (
          <Box className="flex items-center gap-2 py-1 text-[var(--text-secondary)]">
            <IconLink size={16} />
            <Text size="sm">No active share link available.</Text>
          </Box>
        ) : null}

        {!linksQuery.isPending && link ? (
          <Box>
            <Text size="xs" c="dimmed" mb={10}>
              Created {formatDate(link.created_at)}
              {link.last_access_at ? ` • Last opened ${formatDate(link.last_access_at)}` : ''}
            </Text>

            <Box
              className="overflow-hidden text-ellipsis whitespace-nowrap rounded-[10px] border border-[var(--border-soft)] bg-[var(--state-info-bg-soft)] px-3 py-2.5 text-[13px] leading-[1.35] text-[var(--text-primary)]"
              title={link.share_url ?? ''}
            >
              {link.share_url ?? 'Link is not ready yet'}
            </Box>

            <Box className="mt-2 flex items-center justify-between gap-2">
              <Button
                size="sm"
                leftSection={<IconCopy size={14} />}
                onClick={() => {
                  void copyLink(link.share_url)
                }}
                loading={copyingId === link.id}
              >
                Copy link
              </Button>
              <Button
                variant="subtle"
                color="red"
                size="sm"
                leftSection={<IconLinkOff size={14} />}
                onClick={() => {
                  void revokeLink(link.id)
                }}
                disabled={pendingRevoke}
              >
                Disable link
              </Button>
            </Box>
          </Box>
        ) : null}
      </Stack>
    </Modal>
  )
}
