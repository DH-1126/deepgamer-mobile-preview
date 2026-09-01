export type SellerSubject = 'personal' | 'business'

export type SellerApplicationSnapshot = {
  status: 'not_started' | 'under_review'
  subject: SellerSubject | null
  takeoutOrderMediaId?: string
  submittedAt?: number
}

export const emptySellerApplication: SellerApplicationSnapshot = { status: 'not_started', subject: null }

export function isChineseName(value: string) {
  return /^[\u4e00-\u9fa5·]{2,20}$/.test(value.trim())
}

export function isMainlandPhone(value: string) {
  return /^1\d{10}$/.test(value.trim())
}

export function isCitizenId(value: string) {
  return /^\d{17}[\dXx]$/.test(value.trim())
}

export function isBusinessLicense(value: string) {
  return /^[0-9A-Z]{8,24}$/i.test(value.trim())
}

export function createSubmittedSellerApplication(subject: SellerSubject, takeoutOrderMediaId: string, now = Date.now()): SellerApplicationSnapshot {
  return { status: 'under_review', subject, takeoutOrderMediaId, submittedAt: now }
}
