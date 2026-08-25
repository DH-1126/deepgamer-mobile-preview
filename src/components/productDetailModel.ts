import type { ProductDetail, PurchasePackage } from '../types/productDetail'

export function canPurchase(detail: Pick<ProductDetail, 'status'>) {
  return detail.status === 'on_sale'
}

export function getPurchaseAmount(price: number, packageType: PurchasePackage) {
  return packageType === 'PREMIUM' ? price + Math.max(99, Math.round(price * 0.08)) : price
}

export function requiresSecondConfirmation(packageType: PurchasePackage) {
  return packageType === 'STANDARD'
}

export function buildOrderPreviewUrl(goodsId: string, packageType: PurchasePackage) {
  return `/orders/preview?goodsId=${encodeURIComponent(goodsId)}&packageType=${packageType}`
}

export function nextGalleryIndex(index: number, direction: -1 | 1, length: number) {
  if (length < 1) return 0
  return (index + direction + length) % length
}
