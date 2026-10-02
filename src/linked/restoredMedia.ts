import type { createRestoredLinkedTransport } from './restoredLinkedTransport'

type RestoredTransport = ReturnType<typeof createRestoredLinkedTransport>
export type RestoredMediaPurpose = 'SELLER_IDENTITY' | 'TAKEOUT_ORDER' | 'GOODS'
export type RestoredMedia = {
  mediaId: string
  purpose: RestoredMediaPurpose
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  contentUrl: string
  createdAt: string
}

const MB = 1024 * 1024

export function createRestoredMediaKeyRegistry(prefix: string) {
  const keys = new WeakMap<File, string>()
  return {
    keyFor(file: File) {
      const existing = keys.get(file)
      if (existing) return existing
      const key = `${prefix}-${crypto.randomUUID()}`
      keys.set(file, key)
      return key
    },
  }
}

function parseMedia(value: unknown): RestoredMedia {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('媒体接口数据不符合契约')
  const data = value as Record<string, unknown>
  const keys = ['mediaId', 'purpose', 'mimeType', 'sizeBytes', 'width', 'height', 'contentUrl', 'createdAt'].sort()
  const actual = Object.keys(data).sort()
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) throw new Error('媒体接口数据不符合契约')
  const purpose = data.purpose
  if (typeof data.mediaId !== 'string' || !data.mediaId || !['SELLER_IDENTITY', 'TAKEOUT_ORDER', 'GOODS'].includes(String(purpose))
    || typeof data.mimeType !== 'string' || !data.mimeType || typeof data.sizeBytes !== 'number' || !Number.isSafeInteger(data.sizeBytes) || data.sizeBytes < 1
    || (data.width !== null && (typeof data.width !== 'number' || !Number.isSafeInteger(data.width) || data.width < 1))
    || (data.height !== null && (typeof data.height !== 'number' || !Number.isSafeInteger(data.height) || data.height < 1))
    || typeof data.contentUrl !== 'string' || !data.contentUrl || typeof data.createdAt !== 'string' || !data.createdAt) {
    throw new Error('媒体接口数据不符合契约')
  }
  return data as RestoredMedia
}

function validateFile(file: File, purpose: RestoredMediaPurpose) {
  if (!file.name || file.name.length > 180 || /[\\/\0]/u.test(file.name)) throw new Error('图片文件名无效')
  if (purpose === 'GOODS') {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('商品图片仅支持 JPG、PNG、WEBP')
    if (file.size > 5 * MB) throw new Error('商品图片不能超过 5MB')
  } else {
    if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('身份与订单截图仅支持 JPG、PNG')
    if (file.size > 10 * MB) throw new Error('身份与订单截图不能超过 10MB')
  }
  if (file.size < 1) throw new Error('图片文件不能为空')
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

export async function uploadRestoredMedia(transport: RestoredTransport, file: File, purpose: RestoredMediaPurpose, key: string, signal?: AbortSignal): Promise<RestoredMedia> {
  validateFile(file, purpose)
  if (signal?.aborted) throw new Error('请求已取消')
  const dataBase64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()))
  const { data } = await transport.write('/client/media', { purpose, fileName: file.name, mimeType: file.type, dataBase64 }, key, parseMedia, signal)
  if (data.purpose !== purpose) throw new Error('媒体用途回读不一致')
  return data
}
