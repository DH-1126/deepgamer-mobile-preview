import type { createRestoredLinkedTransport } from './restoredLinkedTransport'

type RestoredTransport = Pick<ReturnType<typeof createRestoredLinkedTransport>, 'write'>
export const RECYCLE_MEDIA_MAX_BYTES = 1_048_576
export const RECYCLE_MEDIA_MAX_COUNT = 15
export const RECYCLE_MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type RestoredRecycleMedia = {
  mediaId: string
  mimeType: (typeof RECYCLE_MEDIA_MIME_TYPES)[number]
  sizeBytes: number
  width: number | null
  height: number | null
  contentUrl: string
  createdAt: string
}

const mediaId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 100 && /^[A-Za-z0-9_-]+$/u.test(value)
const dimension = (value: unknown) => value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
const mimeType = (value: unknown): value is RestoredRecycleMedia['mimeType'] => RECYCLE_MEDIA_MIME_TYPES.includes(value as RestoredRecycleMedia['mimeType'])

function fail(): never {
  throw new Error('回收媒体接口数据不符合契约')
}

function exactObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail()
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== keys.length || !keys.every(key => Object.hasOwn(row, key))) fail()
  return row
}

export function expectedRecycleMediaContentUrl(id: string, consultationId?: string) {
  if (!mediaId(id) || (consultationId !== undefined && !mediaId(consultationId))) fail()
  return consultationId === undefined
    ? `/api/v1/client/recycle/media/${encodeURIComponent(id)}/content`
    : `/api/v1/client/recycle/consultations/${encodeURIComponent(consultationId)}/media/${encodeURIComponent(id)}/content`
}

export function parseRestoredRecycleMedia(value: unknown, consultationId?: string): RestoredRecycleMedia {
  const row = exactObject(value, ['mediaId', 'mimeType', 'sizeBytes', 'width', 'height', 'contentUrl', 'createdAt'])
  if (!mediaId(row.mediaId) || !mimeType(row.mimeType) || typeof row.sizeBytes !== 'number' || !Number.isSafeInteger(row.sizeBytes)
    || row.sizeBytes < 1 || row.sizeBytes >= RECYCLE_MEDIA_MAX_BYTES || !dimension(row.width) || !dimension(row.height)
    || typeof row.contentUrl !== 'string' || row.contentUrl !== expectedRecycleMediaContentUrl(row.mediaId, consultationId)
    || typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt))) fail()
  return row as RestoredRecycleMedia
}

export function createRecycleMediaKeyRegistry(prefix: string) {
  const keys = new WeakMap<File, string>()
  return {
    keyFor(file: File) {
      const existing = keys.get(file)
      if (existing) return existing
      const key = `${prefix}-${crypto.randomUUID()}`.slice(0, 100)
      keys.set(file, key)
      return key
    },
  }
}

export function validateRestoredRecycleMediaFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (!file.name || file.name.length > 180 || /[\\/\0]/u.test(file.name)) return '图片文件名无效'
  if (!mimeType(file.type)) return '回收资料图片仅支持 JPG、PNG、WebP'
  if (file.size < 1) return '回收资料图片不能为空'
  if (file.size >= RECYCLE_MEDIA_MAX_BYTES) return '每张回收资料图片必须小于 1MB'
  return null
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

export async function uploadRestoredRecycleMedia(transport: RestoredTransport, file: File, key: string, signal?: AbortSignal): Promise<RestoredRecycleMedia> {
  const problem = validateRestoredRecycleMediaFile(file)
  if (problem) throw new Error(problem)
  if (signal?.aborted) throw new Error('请求已取消')
  const dataBase64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()))
  const { data } = await transport.write('/client/recycle/media', { fileName: file.name, mimeType: file.type, dataBase64 }, key, value => parseRestoredRecycleMedia(value), signal)
  if (data.mimeType !== file.type || data.sizeBytes !== file.size) fail()
  return data
}
