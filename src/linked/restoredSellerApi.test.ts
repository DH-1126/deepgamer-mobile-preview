import { describe, expect, it, vi } from 'vitest'
import type { createRestoredLinkedTransport } from './restoredLinkedTransport'
import {
  restoredSellerSignatureSimulationKey,
  readRestoredSeller,
  readRestoredSellerSignature,
  simulateRestoredSellerSignature,
  startRestoredSellerSignature,
  submitRestoredSellerApplication,
} from './restoredSellerApi'

type Transport = ReturnType<typeof createRestoredLinkedTransport>

const application = {
  subject: 'personal' as const,
  applicationName: '张三',
  idNumber: '110101199001011234',
  contactName: '张三',
  contactPhone: '13800138000',
  takeoutOrderMediaId: 'media-takeout',
  emergencyName: '李四',
  emergencyPhone: '13900139000',
  idFrontMediaId: 'media-front',
  idBackMediaId: 'media-back',
}

const signature = {
  id: 'signature-1', applicationId: 'application-1', provenance: 'LOCAL_DEMO' as const,
  status: 'PENDING' as const, rowVersion: 1, createdAt: '2026-09-23T00:00:00.000Z', updatedAt: '2026-09-23T00:00:00.000Z',
}

const seller = {
  id: 'seller-1', sellerRef: 'seller-ref-1', displayName: '演示卖家', status: 'APPROVED' as const,
  contractStatus: 'UNSIGNED' as const, rowVersion: 3, application, applicationId: 'application-1',
  reviewReason: null, submittedAt: '2026-09-23T00:00:00.000Z', reviewedAt: '2026-09-23T00:01:00.000Z',
  provenance: 'LOCAL_DEMO' as const, signature, canPublish: false,
}

function transportReturning(data: unknown) {
  return {
    read: vi.fn(async (_path, parse) => ({ data: parse(data) })),
    write: vi.fn(async (_path, _body, _key, parse) => ({ data: parse(data) })),
  } as unknown as Transport
}

describe('restored seller API', () => {
  it('reads the strict seller contract and rejects unverified response fields', async () => {
    const transport = transportReturning(seller)
    await expect(readRestoredSeller(transport)).resolves.toEqual(seller)
    expect(transport.read).toHaveBeenCalledWith('/client/seller', expect.any(Function), undefined)

    const invalid = transportReturning({ ...seller, mockIdentity: true })
    await expect(readRestoredSeller(invalid)).rejects.toThrow('卖家接口数据不符合契约')
  })

  it('accepts a service-authored review reason longer than ordinary form fields', async () => {
    const reviewed = { ...seller, status: 'REJECTED' as const, reviewReason: '需补充'.repeat(50) }
    await expect(readRestoredSeller(transportReturning(reviewed))).resolves.toEqual(reviewed)
  })

  it('rejects a seller application whose phone no longer satisfies the shared schema', async () => {
    const invalid = { ...seller, application: { ...application, contactPhone: 'not-a-phone' } }
    await expect(readRestoredSeller(transportReturning(invalid))).rejects.toThrow('卖家接口数据不符合契约')
  })

  it('submits the exact application with row version and stable operation key', async () => {
    const transport = transportReturning(seller)
    await submitRestoredSellerApplication(transport, 2, application, 'seller-submit-application-1')
    expect(transport.write).toHaveBeenCalledWith(
      '/client/seller/application',
      { rowVersion: 2, application },
      'seller-submit-application-1',
      expect.any(Function),
      undefined,
    )
  })

  it('starts, queries and resolves the same signature task without opening another task', async () => {
    const sellerTransport = transportReturning(seller)
    await startRestoredSellerSignature(sellerTransport, 3, 'seller-signature-start-application-1')
    expect(sellerTransport.write).toHaveBeenCalledWith(
      '/client/seller/signature', { rowVersion: 3 }, 'seller-signature-start-application-1', expect.any(Function), undefined,
    )

    const signatureTransport = transportReturning(signature)
    await readRestoredSellerSignature(signatureTransport, signature.id)
    expect(signatureTransport.read).toHaveBeenCalledWith('/client/seller/signature/signature-1', expect.any(Function), undefined)

    const resultTransport = transportReturning(seller)
    await simulateRestoredSellerSignature(resultTransport, signature.id, 1, 'UNKNOWN', 'seller-signature-result-signature-1')
    expect(resultTransport.write).toHaveBeenCalledWith(
      '/client/seller/signature/signature-1/simulate',
      { rowVersion: 1, result: 'UNKNOWN' },
      'seller-signature-result-signature-1',
      expect.any(Function),
      undefined,
    )
    expect(() => simulateRestoredSellerSignature(resultTransport, signature.id, 1, 'PENDING' as never, 'seller-signature-invalid-result')).toThrow('模拟签署结果不符合契约')
  })

  it('isolates the same simulated result by signature task while keeping retries stable', () => {
    const first = restoredSellerSignatureSimulationKey({ ...signature, id: 'client_signature_first', rowVersion: 1 }, 'FAILED')
    const retry = restoredSellerSignatureSimulationKey({ ...signature, id: 'client_signature_first', rowVersion: 1 }, 'FAILED')
    const second = restoredSellerSignatureSimulationKey({ ...signature, id: 'client_signature_second', rowVersion: 1 }, 'FAILED')

    expect(first).toBe('seller-signature-client_signature_first-1-failed')
    expect(retry).toBe(first)
    expect(second).not.toBe(first)
    expect(new TextEncoder().encode(restoredSellerSignatureSimulationKey({ ...signature, id: 'x'.repeat(100) }, 'SUCCEEDED')).byteLength).toBeLessThanOrEqual(100)
  })
})
