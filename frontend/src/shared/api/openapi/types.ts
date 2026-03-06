import type { components, operations } from './schema'

export type MeDto = components['schemas']['MeResponse']
export type GoogleStatusDto = components['schemas']['GoogleStatusResponse']
export type GoogleDriveFileDto = components['schemas']['GoogleDriveFile']
export type FolderTreeDto = components['schemas']['FolderTreeResponse']
export type FolderTreeNodeDto = components['schemas']['FolderTreeNode']
export type ItemResourceDto = components['schemas']['ItemResource']
export type ListItemsDto = components['schemas']['ListItemsResponse']
export type BreadcrumbDto = components['schemas']['Breadcrumb']
export type FolderRefDto = components['schemas']['FolderRef']
export type GoogleConnectDto = components['schemas']['GoogleConnectResponse']
export type ImportFromGoogleRequestDto = components['schemas']['ImportFromGoogleRequest']
export type ErrorEnvelopeDto = components['schemas']['ErrorEnvelope']

export type ListItemsParams = operations['listItems']['parameters']['query']
export type GoogleFilesParams = operations['getGoogleFiles']['parameters']['query']
