export type MaterialUploadStatus = 'uploading' | 'ready' | 'failed'
export type MaterialUpload = { id: string; name: string; status: MaterialUploadStatus; preview?: string; file?: File }
export const MAX_AFTERSALE_MATERIALS = 6
export function validateAfterSaleMaterials(files: Pick<File, 'type' | 'size'>[], currentCount: number) {
  if (files.length + currentCount > MAX_AFTERSALE_MATERIALS) return '最多上传 6 张，请减少选择的图片'
  if (files.some(file => !['image/jpeg', 'image/png'].includes(file.type))) return '仅支持 JPG、PNG 图片'
  if (files.some(file => file.size > 10 * 1024 * 1024)) return '单张图片不能超过 10MB'
  return ''
}
export function materialUploadSummary(items: MaterialUpload[]) {
  return { names: items.filter(item => item.status === 'ready').map(item => item.name), blocked: items.some(item => item.status !== 'ready') }
}
