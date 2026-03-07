import {
  IconAlertTriangle,
  IconCheck,
  IconFile,
  IconFileCheck,
  IconX,
} from '@tabler/icons-react'

import type { DragImportFailure } from '@/features/drag-import-files'
import { Badge, Box, Group, Modal, ScrollArea, Stack, Text } from '@/shared/ui'
import './import-results-dialog.css'

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
    <Modal opened={opened} onClose={onClose} title="Import results" size="lg" centered>
      <Stack className="import-results-dialog" gap="md">
        <Box
          className={[
            'import-results-dialog__hero',
            hasFailures ? 'import-results-dialog__hero--warning' : 'import-results-dialog__hero--success',
          ].join(' ')}
        >
          <Group gap={10} wrap="nowrap" align="flex-start">
            <span className="import-results-dialog__hero-icon">
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

        <Box className="import-results-dialog__stats">
          <Box className="import-results-dialog__stat-card import-results-dialog__stat-card--success">
            <Text size="xs" c="dimmed">
              Imported
            </Text>
            <Text size="lg" fw={700}>
              {importedCount}
            </Text>
          </Box>
          <Box className="import-results-dialog__stat-card import-results-dialog__stat-card--failed">
            <Text size="xs" c="dimmed">
              Failed
            </Text>
            <Text size="lg" fw={700}>
              {failedCount}
            </Text>
          </Box>
          <Box className="import-results-dialog__stat-card">
            <Text size="xs" c="dimmed">
              Total
            </Text>
            <Text size="lg" fw={700}>
              {totalCount}
            </Text>
          </Box>
        </Box>

        <Box className="import-results-dialog__sections">
          <Box className="import-results-dialog__section">
            <Group justify="space-between" wrap="nowrap">
              <Group gap={6} wrap="nowrap">
                <IconFileCheck size={16} color="#2f9e44" />
                <Text size="sm" fw={600}>
                  Imported files
                </Text>
              </Group>
              <Badge variant="light" color="green">
                {importedCount}
              </Badge>
            </Group>
            {importedCount > 0 ? (
              <ScrollArea h={Math.min(220, importedCount * 34 + 12)} mt={8}>
                <Stack gap={6}>
                  {uploadedFiles.map((fileName, index) => (
                    <Group key={`${fileName}:${index}`} className="import-results-dialog__file-row" wrap="nowrap">
                      <IconFile size={14} color="#667085" />
                      <Text size="sm" truncate="end">
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

          <Box className="import-results-dialog__section">
            <Group justify="space-between" wrap="nowrap">
              <Group gap={6} wrap="nowrap">
                <IconX size={16} color="#e03131" />
                <Text size="sm" fw={600}>
                  Failed files
                </Text>
              </Group>
              <Badge variant="light" color={failedCount > 0 ? 'red' : 'gray'}>
                {failedCount}
              </Badge>
            </Group>
            {failedCount > 0 ? (
              <ScrollArea h={Math.min(250, failedCount * 58 + 12)} mt={8}>
                <Stack gap={8}>
                  {failedFiles.map((failure, index) => (
                    <Box key={`${failure.fileName}:${failure.message}:${index}`} className="import-results-dialog__failed-row">
                      <Group justify="space-between" gap={6} wrap="nowrap">
                        <Text size="sm" fw={500} truncate="end">
                          {failure.fileName}
                        </Text>
                        <Badge variant="light" color={failure.reason === 'too_large' ? 'orange' : 'red'}>
                          {toFailureReasonLabel(failure)}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed" mt={2}>
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
