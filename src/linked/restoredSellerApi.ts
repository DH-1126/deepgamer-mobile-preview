import type { createRestoredLinkedTransport } from './restoredLinkedTransport'

type RestoredTransport = ReturnType<typeof createRestoredLinkedTransport>

export type RestoredSellerApplication =
  | {
    subject: 'personal'; applicationName: string; idNumber: string; contactName: string; contactPhone: string;
    takeoutOrderMediaId: string; emergencyName: string; emergencyPhone: string; idFrontMediaId: string; idBackMediaId: string;
  }
  | {
    subject: 'business'; entityType: 'individual' | 'company'; applicationName: string; licenseNo: string;
    operatorName: string; operatorIdNumber: string; contactName: string; contactPhone: string; takeoutOrderMediaId: string;
    businessLicenseMediaId: string; operatorIdFrontMediaId: string; operatorIdBackMediaId: string;
  }

export type RestoredSellerSignature = {
  id: string
  applicationId: string
  provenance: 'LOCAL_DEMO'
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN'
  rowVersion: number
  createdAt: string
  updatedAt: string
}

export type RestoredSeller = {
  id: string
  sellerRef: string | null
  displayName: string
  status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED'
  contractStatus: 'UNSIGNED' | 'SIGNED'
  rowVersion: number
  application: RestoredSellerApplication | null
  applicationId: string | null
  reviewReason: string | null
  submittedAt: string | null
  reviewedAt: string | null
  provenance: 'LOCAL_DEMO' | 'UNVERIFIED' | null
  signature: RestoredSellerSignature | null
  canPublish: boolean
}

type ObjectValue = Record<string, unknown>

function record(value: unknown, label: string): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}接口数据不符合契约`)
  return value as ObjectValue
}

function exact(value: ObjectValue, keys: readonly string[], label: string) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label}接口数据不符合契约`)
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 100) throw new Error(`${label}接口数据不符合契约`)
  return value.trim()
}

function phone(value: unknown, label: string): string {
  const parsed = text(value, label)
  if (!/^\d{11}$/u.test(parsed)) throw new Error(`${label}接口数据不符合契约`)
  return parsed
}

function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label)
}

function nullableString(value: unknown, label: string): string | null {
  if (value !== null && typeof value !== 'string') throw new Error(`${label}接口数据不符合契约`)
  return value
}

function enumeration<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${label}接口数据不符合契约`)
  return value as T
}

function version(value: unknown, minimum: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`${label}接口数据不符合契约`)
  return value
}

export function parseRestoredSellerApplication(value: unknown): RestoredSellerApplication {
  const data = record(value, '卖家')
  if (data.subject === 'personal') {
    const keys = ['subject', 'applicationName', 'idNumber', 'contactName', 'contactPhone', 'takeoutOrderMediaId', 'emergencyName', 'emergencyPhone', 'idFrontMediaId', 'idBackMediaId'] as const
    exact(data, keys, '卖家')
    return {
      subject: 'personal', applicationName: text(data.applicationName, '卖家'), idNumber: text(data.idNumber, '卖家'),
      contactName: text(data.contactName, '卖家'), contactPhone: phone(data.contactPhone, '卖家'),
      takeoutOrderMediaId: text(data.takeoutOrderMediaId, '卖家'), emergencyName: text(data.emergencyName, '卖家'),
      emergencyPhone: phone(data.emergencyPhone, '卖家'), idFrontMediaId: text(data.idFrontMediaId, '卖家'), idBackMediaId: text(data.idBackMediaId, '卖家'),
    }
  }
  exact(data, ['subject', 'entityType', 'applicationName', 'licenseNo', 'operatorName', 'operatorIdNumber', 'contactName', 'contactPhone', 'takeoutOrderMediaId', 'businessLicenseMediaId', 'operatorIdFrontMediaId', 'operatorIdBackMediaId'], '卖家')
  return {
    subject: enumeration(data.subject, ['business'], '卖家'), entityType: enumeration(data.entityType, ['individual', 'company'], '卖家'),
    applicationName: text(data.applicationName, '卖家'), licenseNo: text(data.licenseNo, '卖家'), operatorName: text(data.operatorName, '卖家'),
    operatorIdNumber: text(data.operatorIdNumber, '卖家'), contactName: text(data.contactName, '卖家'), contactPhone: phone(data.contactPhone, '卖家'),
    takeoutOrderMediaId: text(data.takeoutOrderMediaId, '卖家'), businessLicenseMediaId: text(data.businessLicenseMediaId, '卖家'),
    operatorIdFrontMediaId: text(data.operatorIdFrontMediaId, '卖家'), operatorIdBackMediaId: text(data.operatorIdBackMediaId, '卖家'),
  }
}

export function parseRestoredSellerSignature(value: unknown): RestoredSellerSignature {
  const data = record(value, '签署')
  exact(data, ['id', 'applicationId', 'provenance', 'status', 'rowVersion', 'createdAt', 'updatedAt'], '签署')
  return {
    id: text(data.id, '签署'), applicationId: text(data.applicationId, '签署'), provenance: enumeration(data.provenance, ['LOCAL_DEMO'], '签署'),
    status: enumeration(data.status, ['PENDING', 'SUCCEEDED', 'FAILED', 'UNKNOWN'], '签署'), rowVersion: version(data.rowVersion, 1, '签署'),
    createdAt: text(data.createdAt, '签署'), updatedAt: text(data.updatedAt, '签署'),
  }
}

export function parseRestoredSeller(value: unknown): RestoredSeller {
  const data = record(value, '卖家')
  exact(data, ['id', 'sellerRef', 'displayName', 'status', 'contractStatus', 'rowVersion', 'application', 'applicationId', 'reviewReason', 'submittedAt', 'reviewedAt', 'provenance', 'signature', 'canPublish'], '卖家')
  if (typeof data.canPublish !== 'boolean') throw new Error('卖家接口数据不符合契约')
  return {
    id: text(data.id, '卖家'), sellerRef: nullableText(data.sellerRef, '卖家'), displayName: text(data.displayName, '卖家'),
    status: enumeration(data.status, ['NONE', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED'], '卖家'),
    contractStatus: enumeration(data.contractStatus, ['UNSIGNED', 'SIGNED'], '卖家'), rowVersion: version(data.rowVersion, 0, '卖家'),
    application: data.application === null ? null : parseRestoredSellerApplication(data.application), applicationId: nullableText(data.applicationId, '卖家'),
    reviewReason: nullableString(data.reviewReason, '卖家'), submittedAt: nullableText(data.submittedAt, '卖家'), reviewedAt: nullableText(data.reviewedAt, '卖家'),
    provenance: data.provenance === null ? null : enumeration(data.provenance, ['LOCAL_DEMO', 'UNVERIFIED'] as const, '卖家'),
    signature: data.signature === null ? null : parseRestoredSellerSignature(data.signature), canPublish: data.canPublish,
  }
}

export function readRestoredSeller(transport: RestoredTransport, signal?: AbortSignal) {
  return transport.read('/client/seller', parseRestoredSeller, signal).then(({ data }) => data)
}

export function submitRestoredSellerApplication(transport: RestoredTransport, rowVersion: number, application: RestoredSellerApplication, key: string, signal?: AbortSignal) {
  return transport.write('/client/seller/application', { rowVersion, application }, key, parseRestoredSeller, signal).then(({ data }) => data)
}

export function startRestoredSellerSignature(transport: RestoredTransport, rowVersion: number, key: string, signal?: AbortSignal) {
  return transport.write('/client/seller/signature', { rowVersion }, key, parseRestoredSeller, signal).then(({ data }) => data)
}

export function readRestoredSellerSignature(transport: RestoredTransport, id: string, signal?: AbortSignal) {
  return transport.read(`/client/seller/signature/${encodeURIComponent(id)}`, parseRestoredSellerSignature, signal).then(({ data }) => data)
}

function signatureTaskFingerprint(value: string): string {
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (const byte of new TextEncoder().encode(value)) {
    first = Math.imul(first ^ byte, 0x01000193)
    second = Math.imul(second ^ byte, 0x85ebca6b)
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}

export function restoredSellerSignatureSimulationKey(
  task: Pick<RestoredSellerSignature, 'id' | 'rowVersion'>,
  result: Exclude<RestoredSellerSignature['status'], 'PENDING'>,
): string {
  const prefix = 'seller-signature-'
  const suffix = `-${task.rowVersion}-${result.toLowerCase()}`
  const direct = `${prefix}${task.id}${suffix}`
  if (/^[\x21-\x7e]+$/u.test(task.id) && direct.length <= 100) return direct
  const fingerprint = signatureTaskFingerprint(task.id)
  const available = 100 - prefix.length - suffix.length - fingerprint.length - 1
  const visible = /^[\x21-\x7e]+$/u.test(task.id) && available > 0 ? `${task.id.slice(0, available)}-` : ''
  return `${prefix}${visible}${fingerprint}${suffix}`
}

export function simulateRestoredSellerSignature(transport: RestoredTransport, id: string, rowVersion: number, result: Exclude<RestoredSellerSignature['status'], 'PENDING'>, key: string, signal?: AbortSignal) {
  if (!['SUCCEEDED', 'FAILED', 'UNKNOWN'].includes(result)) throw new Error('模拟签署结果不符合契约')
  return transport.write(`/client/seller/signature/${encodeURIComponent(id)}/simulate`, { rowVersion, result }, key, parseRestoredSeller, signal).then(({ data }) => data)
}
