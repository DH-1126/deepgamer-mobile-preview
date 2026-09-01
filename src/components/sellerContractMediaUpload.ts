export const TAKEOUT_ORDER_MAX_FILE_SIZE = 10 * 1024 * 1024

const TAKEOUT_ORDER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

export type SellerContractMediaUpload = {
  mediaId: string
  fileName: string
}

export function validateTakeoutOrderImage(file: Pick<File, 'type' | 'size'>) {
  if (!TAKEOUT_ORDER_IMAGE_TYPES.has(file.type)) return '仅支持 JPG、PNG 格式图片'
  if (file.size > TAKEOUT_ORDER_MAX_FILE_SIZE) return '图片大小不能超过 10MB'
  return ''
}

/**
 * 用户端尚未接入真实媒体服务。这里是唯一的上传适配层：接入接口后只需
 * 将本地处理替换为 multipart 上传，并返回服务端 mediaId，页面契约无需变化。
 */
export async function uploadSellerContractMedia(file: File): Promise<SellerContractMediaUpload> {
  const validationError = validateTakeoutOrderImage(file)
  if (validationError) throw new Error(validationError)

  // 读取文件模拟实际上传耗时，也能让浏览器暴露“上传中”和读取失败状态。
  const bytes = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const fingerprint = Array.from(new Uint8Array(digest).slice(0, 8), (byte) => byte.toString(16).padStart(2, '0')).join('')

  return {
    mediaId: `local_takeout_${fingerprint}_${Date.now()}`,
    fileName: file.name,
  }
}
