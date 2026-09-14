export type SellerSubject = 'personal' | 'business'
export type SellerEntityType = 'individual' | 'company'
export type SellerApplicationStatus = 'not_started' | 'under_review' | 'changes_requested' | 'approved' | 'active'

/** Only non-sensitive workflow markers may be persisted. Form fields stay in component memory. */
export type SellerApplicationSnapshot = {
  status: SellerApplicationStatus
  subject: SellerSubject | null
  entityType?: SellerEntityType
  takeoutOrderMediaId?: string
  submittedAt?: number
}

export const emptySellerApplication: SellerApplicationSnapshot = { status: 'not_started', subject: null }

/** Prevents a next-step click from becoming a submit when React swaps the footer button during the same event. */
export function advanceSellerApplicationStep(event: Pick<Event, 'preventDefault'>, onNext: () => void) {
  event.preventDefault()
  onNext()
}

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

export function isRecognizedAddress(value: string) {
  return value.trim().length >= 5 && value.trim().length <= 120
}

export function createSubmittedSellerApplication(
  subject: SellerSubject,
  takeoutOrderMediaId: string,
  now = Date.now(),
  entityType?: SellerEntityType,
): SellerApplicationSnapshot {
  return { status: 'under_review', subject, takeoutOrderMediaId, submittedAt: now, ...(entityType ? { entityType } : {}) }
}

export function withApplicationStatus(snapshot: SellerApplicationSnapshot, status: SellerApplicationStatus): SellerApplicationSnapshot {
  if (status === 'not_started') return emptySellerApplication
  if (!snapshot.subject) return emptySellerApplication
  return { ...snapshot, status }
}

export type SellerPrototypeScenario = 'buyer' | 'review' | 'rejected' | 'approved' | 'complete'

export function parseSellerPrototypeScenario(value: string | null): SellerPrototypeScenario | null {
  if (value === 'not_started') return 'buyer'
  if (value === 'under_review') return 'review'
  if (value === 'failed' || value === 'changes_requested') return 'rejected'
  return value === 'buyer' || value === 'review' || value === 'rejected' || value === 'approved' || value === 'complete' ? value : null
}

export function applySellerPrototypeScenario(snapshot: SellerApplicationSnapshot, scenario: SellerPrototypeScenario | null): SellerApplicationSnapshot {
  if (!scenario) return snapshot
  if (scenario === 'buyer') return emptySellerApplication
  const subject = snapshot.subject ?? 'personal'
  const base = { ...snapshot, subject }
  if (scenario === 'review') return { ...base, status: 'under_review' }
  if (scenario === 'rejected') return { ...base, status: 'changes_requested' }
  if (scenario === 'approved') return { ...base, status: 'approved' }
  return { ...base, status: 'active' }
}
