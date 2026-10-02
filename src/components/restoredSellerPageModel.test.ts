import { describe, expect, it } from 'vitest'
import type { RestoredSeller } from '../linked/restoredSellerApi'
import {
  findStartedRestoredSignature,
  restoredSellerPageKind,
  restoredSellerCenterView,
  restoredSignatureAction,
  restoredChangesRequestedCopy,
  restoredReviewingGuidance,
  restoredTakeoutOrderGuidance,
  restoredTakeoutOrderReviewLabel,
  sameRestoredApplication,
} from './restoredSellerPageModel'

const seller = (overrides: Partial<RestoredSeller> = {}): RestoredSeller => ({
  id: 'seller-1', sellerRef: 'seller-ref-1', displayName: '演示卖家', status: 'NONE', contractStatus: 'UNSIGNED', rowVersion: 0,
  application: null, applicationId: null, reviewReason: null, submittedAt: null, reviewedAt: null, provenance: null, signature: null, canPublish: false,
  ...overrides,
})

describe('restored seller page state', () => {
  it.each([
    [seller(), 'guide'],
    [seller({ status: 'PENDING', provenance: 'LOCAL_DEMO' }), 'reviewing'],
    [seller({ status: 'REJECTED', provenance: 'LOCAL_DEMO' }), 'changes_requested'],
    [seller({ status: 'APPROVED', provenance: 'LOCAL_DEMO' }), 'approved'],
    [seller({ status: 'APPROVED', provenance: 'LOCAL_DEMO', signature: { id: 'sig', applicationId: 'app', provenance: 'LOCAL_DEMO', status: 'PENDING', rowVersion: 1, createdAt: 'now', updatedAt: 'now' } }), 'signing'],
    [seller({ status: 'APPROVED', provenance: 'LOCAL_DEMO', contractStatus: 'SIGNED', signature: { id: 'sig', applicationId: 'app', provenance: 'LOCAL_DEMO', status: 'SUCCEEDED', rowVersion: 2, createdAt: 'now', updatedAt: 'now' }, canPublish: true }), 'active'],
    [seller({ status: 'APPROVED', provenance: 'LOCAL_DEMO', contractStatus: 'SIGNED', signature: { id: 'sig', applicationId: 'app', provenance: 'LOCAL_DEMO', status: 'SUCCEEDED', rowVersion: 2, createdAt: 'now', updatedAt: 'now' }, canPublish: false }), 'capability_blocked'],
    [seller({ status: 'DISABLED' }), 'disabled'],
    [seller({ status: 'APPROVED', provenance: 'UNVERIFIED' }), 'unverified'],
  ] as const)('maps authoritative state to %s without inferring success', (value, expected) => {
    expect(restoredSellerPageKind(value)).toBe(expected)
  })

  it('matches an unknown submission only when the server returns the same strict application', () => {
    const application = {
      subject: 'personal' as const, applicationName: '张三', idNumber: '110101199001011234', contactName: '张三', contactPhone: '13800138000',
      takeoutOrderMediaId: 'takeout', emergencyName: '李四', emergencyPhone: '13900139000', idFrontMediaId: 'front', idBackMediaId: 'back',
    }
    expect(sameRestoredApplication(application, { ...application })).toBe(true)
    expect(sameRestoredApplication(application, { ...application, idFrontMediaId: 'other' })).toBe(false)
    expect(sameRestoredApplication(application, null)).toBe(false)
  })

  it('does not treat the previous failed task as a recovered signature start', () => {
    const previous = { id: 'signature-old', applicationId: 'application-1', provenance: 'LOCAL_DEMO' as const, status: 'FAILED' as const, rowVersion: 2, createdAt: 'before', updatedAt: 'before' }
    const unchanged = seller({ status: 'APPROVED', provenance: 'LOCAL_DEMO', applicationId: 'application-1', signature: previous })
    const pending = { ...previous, id: 'signature-new', status: 'PENDING' as const, rowVersion: 1 }
    const recovered = seller({ status: 'APPROVED', provenance: 'LOCAL_DEMO', applicationId: 'application-1', signature: pending })

    expect(findStartedRestoredSignature(unchanged, 'application-1', previous)).toBeNull()
    expect(findStartedRestoredSignature(recovered, 'application-1', previous)).toEqual(pending)
    expect(findStartedRestoredSignature({ ...recovered, signature: { ...pending, status: 'UNKNOWN' } }, 'application-1', previous)).toBeNull()
  })

  it('describes restored takeout evidence without claiming OCR or an early upload', () => {
    expect(restoredTakeoutOrderGuidance()).toBe('请上传近 30 天相关订单截图，并确保截图主体与联系人信息一致；未接入 OCR，将由人工核验。')
    expect(restoredTakeoutOrderReviewLabel({ mediaId: '', file: {} })).toBe('已选择，提交时上传')
    expect(restoredTakeoutOrderReviewLabel({ mediaId: 'media-existing' })).toBe('已上传，可复用')
  })

  it('describes restored review states without unsupported field approvals or messages', () => {
    expect(restoredReviewingGuidance()).toContain('页面可见时会定时回读审核结果')
    expect(restoredReviewingGuidance()).not.toContain('站内消息')
    expect(restoredChangesRequestedCopy()).toEqual({
      title: '申请未通过',
      detail: '已提交资料已回填，可按审核意见修改后重新提交',
      materialsTitle: '上次提交的资料',
      materialsDetail: '原申请资料将在编辑页回填；是否通过以重新审核结果为准。',
      footerHint: '可在原申请资料上修改后重新提交',
      action: '修改并重新提交',
    })
  })

  it('keeps authoritative seller terminal states ahead of local signing navigation', () => {
    expect(restoredSellerCenterView('approved', true)).toBe('signing')
    expect(restoredSellerCenterView('signing', false)).toBe('signing')
    expect(restoredSellerCenterView('active', true)).toBe('active')
    expect(restoredSellerCenterView('capability_blocked', true)).toBe('capability_blocked')
    expect(restoredSellerCenterView('disabled', true)).toBe('disabled')
  })

  it('never exposes simulation actions for a succeeded signature task', () => {
    expect(restoredSignatureAction(null)).toBe('start')
    expect(restoredSignatureAction('FAILED')).toBe('start')
    expect(restoredSignatureAction('PENDING')).toBe('simulate')
    expect(restoredSignatureAction('UNKNOWN')).toBe('simulate')
    expect(restoredSignatureAction('SUCCEEDED')).toBe('complete')
  })
})
