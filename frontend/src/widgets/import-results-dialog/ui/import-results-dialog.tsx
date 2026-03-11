import {
  IconAlertTriangle,
  IconCheck,
  IconFile,
  IconFileCheck,
  IconX,
} from '@tabler/icons-react'

import type { DragImportFailure } from '@/features/drag-import-files'
import { Badge, Box, Group, Modal, ScrollArea, Stack, Text } from '@/shared/ui'

type ImportResultsDialogProps = {
  opened: boolean
  uploadedFiles: string[]
  failedFiles: DragImportFailure[]
  onClose: () => void
}

export const ImportResultsDialog = ({
  opened,
  uploadedFiles,
  failedFiles,
  onClose,
}: ImportResultsDialogProps) => {
  const importedCount = uploadedFiles.length
  const failedCount = failedFiles.length
  const totalCount = importedCount + failedCount
  const hasFailures = failedCount > 0

  const statusTitle = hasFailures ? 'Import completed with issues' : 'Import completed successfully'
  const statusDescription = hasFailures
    ? 'Some files were skipped or failed. Review details below.'
    : 'All files were imported to the selected folder.'

  const toFailureReasonLabel = (failure: DragImportFailure): string =>
    failure.reason === 'too_large' ? 'Too large' : 'Upload failed'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Import results"
      size={680}
      centered
      styles={{
        content: {
          height: 'min(720px, calc(100dvh - 24px))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
        header: {
          padding: '10px',
          minHeight: 0,
        },
        title: {
          fontSize: '0.95rem',
          lineHeight: 1.2,
        },
        close: {
          width: 28,
          height: 28,
        },
        body: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          padding: '18px 16px 16px',
        },
      }}
    >
      <Stack className="flex-1 min-h-0" gap="md">
        <Box
          className={[
            'rounded-[10px] border border-[var(--border-soft)] px-3 py-2.5',
            hasFailures ? 'bg-[var(--state-warning-bg)]' : 'bg-[var(--state-success-bg)]',
          ].join(' ')}
        >
          <Group gap={10} wrap="nowrap" align="flex-start">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)]">
              {hasFailures ? <IconAlertTriangle size={18} /> : <IconCheck size={18} />}
            </span>
            <Stack gap={2}>
              <Text size="sm" fw={700}>
                {statusTitle}
              </Text>
              <Text size="xs" c="dimmed">
                {statusDescription}
              </Text>
            </Stack>
          </Group>
        </Box>

        <Box className="grid grid-cols-3 gap-2 max-[760px]:grid-cols-1">
          <Box className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--state-success-bg-soft)] px-3 py-2.5">
            <Text size="xs" c="dimmed">
              Imported
            </Text>
            <Text size="lg" fw={700}>
              {importedCount}
            </Text>
          </Box>
          <Box className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--state-danger-bg-soft)] px-3 py-2.5">
            <Text size="xs" c="dimmed">
              Failed
            </Text>
            <Text size="lg" fw={700}>
              {failedCount}
            </Text>
          </Box>
          <Box className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2.5">
            <Text size="xs" c="dimmed">
              Total
            </Text>
            <Text size="lg" fw={700}>
              {totalCount}
            </Text>
          </Box>
        </Box>

        <Box className="grid min-h-0 flex-1 grid-cols-2 gap-2.5 max-[760px]:grid-cols-1">
          <Box className="flex min-h-0 max-h-full flex-col overflow-hidden rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-2.5">
            <Group justify="space-between" wrap="nowrap">
              <Group gap={6} wrap="nowrap">
                <IconFileCheck size={16} color="var(--state-success-icon)" />
                <Text size="sm" fw={600}>
                  Imported files
                </Text>
              </Group>
              <Badge variant="light" color="green">
                {importedCount}
              </Badge>
            </Group>
            {importedCount > 0 ? (
              <ScrollArea className="min-h-[120px] flex-1 max-[760px]:min-h-[160px]" mt={8}>
                <Stack gap={6}>
                  {uploadedFiles.map((fileName, index) => (
                    <Group
                      key={`${fileName}:${index}`}
                      className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-2 py-1.5"
                      wrap="nowrap"
                    >
                      <IconFile size={14} color="var(--icon-muted)" className="h-3.5 w-3.5 shrink-0" />
                      <Text size="sm" className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                        {fileName}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </ScrollArea>
            ) : (
              <Text size="xs" c="dimmed" mt={8}>
                No files imported.
              </Text>
            )}
          </Box>

          <Box className="flex min-h-0 max-h-full flex-col overflow-hidden rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-2.5">
            <Group justify="space-between" wrap="nowrap">
              <Group gap={6} wrap="nowrap">
                <IconX size={16} color="var(--state-danger-icon)" />
                <Text size="sm" fw={600}>
                  Failed files
                </Text>
              </Group>
              <Badge variant="light" color={failedCount > 0 ? 'red' : 'gray'}>
                {failedCount}
              </Badge>
            </Group>
            {failedCount > 0 ? (
              <ScrollArea className="min-h-[120px] flex-1 max-[760px]:min-h-[160px]" mt={8}>
                <Stack gap={8}>
                  {failedFiles.map((failure, index) => (
                    <Box
                      key={`${failure.fileName}:${failure.message}:${index}`}
                      className="rounded-lg border border-[var(--state-danger-border)] bg-[var(--state-danger-bg-soft)] p-2"
                    >
                      <Group justify="space-between" gap={6} wrap="wrap" align="flex-start">
                        <Text size="sm" fw={500} className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                          {failure.fileName}
                        </Text>
                        <Badge
                          variant="light"
                          color={failure.reason === 'too_large' ? 'orange' : 'red'}
                          className="shrink-0 whitespace-nowrap"
                        >
                          {toFailureReasonLabel(failure)}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed" mt={2} className="whitespace-normal [overflow-wrap:anywhere]">
                        {failure.message}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              </ScrollArea>
            ) : (
              <Text size="xs" c="dimmed" mt={8}>
                No failures.
              </Text>
            )}
          </Box>
        </Box>
      </Stack>
    </Modal>
  )
}
