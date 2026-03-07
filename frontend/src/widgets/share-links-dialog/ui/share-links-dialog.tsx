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

import './share-links-dialog.css'

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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={null}
      withCloseButton={false}
      centered
      size="md"
      classNames={{
        content: 'share-links-dialog__modal-content',
        body: 'share-links-dialog__modal-body',
      }}
    >
      <Stack gap="sm" className="share-links-dialog__shell">
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={onClose}
          className="share-links-dialog__shell-close"
          aria-label="Close share dialog"
        >
          <IconX size={18} />
        </ActionIcon>

        {linksQuery.error ? (
          <Alert color="red" title="Failed to load share links">
            {toApiError(linksQuery.error).message}
          </Alert>
        ) : null}

        {linksQuery.isPending || createLinkMutation.isPending ? (
          <Box className="share-links-dialog__loading">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Preparing share link...
            </Text>
          </Box>
        ) : null}

        {!linksQuery.isPending && !hasLink ? (
          <Box className="share-links-dialog__empty">
            <IconLink size={16} />
            <Text size="sm">No active share link available.</Text>
          </Box>
        ) : null}

        {!linksQuery.isPending && link ? (
          <Box className="share-links-dialog__panel">
            <Text size="xs" fw={600} className="share-links-dialog__meta-line">
              <IconLink size={12} />
              Read-only
              {link.expires_at ? ` • Expires ${formatDateCompact(link.expires_at)}` : ' • No expiry'}
            </Text>
            <Text size="xs" c="dimmed" mb={6}>
              Created {formatDate(link.created_at)}
              {link.last_access_at ? ` • Last opened ${formatDate(link.last_access_at)}` : ''}
            </Text>

            <Box className="share-links-dialog__link-box" title={link.share_url ?? ''}>
              {link.share_url ?? 'Link is not ready yet'}
            </Box>

            <Box className="share-links-dialog__actions">
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
