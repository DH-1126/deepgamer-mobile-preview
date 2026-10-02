import type { RestoredSeller, RestoredSellerApplication, RestoredSellerSignature } from '../linked/restoredSellerApi'

export type RestoredSellerPageKind = 'guide' | 'reviewing' | 'changes_requested' | 'approved' | 'signing' | 'active' | 'capability_blocked' | 'disabled' | 'unverified'

export function restoredSellerCenterView(kind: RestoredSellerPageKind, signing: boolean): RestoredSellerPageKind {
  return kind === 'approved' && signing ? 'signing' : kind
}

export function restoredSignatureAction(status: RestoredSellerSignature['status'] | null): 'start' | 'simulate' | 'complete' {
  if (status === null || status === 'FAILED') return 'start'
  return status === 'PENDING' || status === 'UNKNOWN' ? 'simulate' : 'complete'
}

export function restoredSellerPageKind(seller: RestoredSeller): RestoredSellerPageKind {
  if (seller.status === 'DISABLED') return 'disabled'
  if (seller.provenance === 'UNVERIFIED') return 'unverified'
  if (seller.status === 'NONE') return 'guide'
  if (seller.status === 'PENDING') return 'reviewing'
  if (seller.status === 'REJECTED') return 'changes_requested'
  if (seller.signature?.status === 'PENDING' || seller.signature?.status === 'UNKNOWN') return 'signing'
  if (seller.signature?.status === 'SUCCEEDED' || seller.contractStatus === 'SIGNED') return seller.canPublish ? 'active' : 'capability_blocked'
  return 'approved'
}

export function sameRestoredApplication(left: RestoredSellerApplication, right: RestoredSellerApplication | null): boolean {
  if (!right || left.subject !== right.subject) return false
  if (left.subject === 'personal' && right.subject === 'personal') {
    return left.applicationName === right.applicationName && left.idNumber === right.idNumber && left.contactName === right.contactName
      && left.contactPhone === right.contactPhone && left.takeoutOrderMediaId === right.takeoutOrderMediaId
      && left.emergencyName === right.emergencyName && left.emergencyPhone === right.emergencyPhone
      && left.idFrontMediaId === right.idFrontMediaId && left.idBackMediaId === right.idBackMediaId
  }
  if (left.subject === 'business' && right.subject === 'business') {
    return left.entityType === right.entityType && left.applicationName === right.applicationName && left.licenseNo === right.licenseNo
      && left.operatorName === right.operatorName && left.operatorIdNumber === right.operatorIdNumber && left.contactName === right.contactName
      && left.contactPhone === right.contactPhone && left.takeoutOrderMediaId === right.takeoutOrderMediaId
      && left.businessLicenseMediaId === right.businessLicenseMediaId && left.operatorIdFrontMediaId === right.operatorIdFrontMediaId
      && left.operatorIdBackMediaId === right.operatorIdBackMediaId
  }
  return false
}

export function findStartedRestoredSignature(
  latest: RestoredSeller,
  applicationId: string | null,
  previous: RestoredSellerSignature | null,
): RestoredSellerSignature | null {
  const signature = latest.signature
  if (!applicationId || latest.applicationId !== applicationId || signature?.applicationId !== applicationId
    || signature.status !== 'PENDING' || signature.id === previous?.id) return null
  return signature
}

export function restoredTakeoutOrderGuidance(): string {
  return '请上传近 30 天相关订单截图，并确保截图主体与联系人信息一致；未接入 OCR，将由人工核验。'
}

export function restoredTakeoutOrderReviewLabel(value: { mediaId: string; file?: unknown } | null): string {
  if (value?.file) return '已选择，提交时上传'
  return value?.mediaId ? '已上传，可复用' : '未选择'
}

export function restoredReviewingGuidance(): string {
  return '可随时离开本页；页面可见时会定时回读审核结果，也可重新进入查看。'
}

export function restoredChangesRequestedCopy() {
  return {
    title: '申请未通过',
    detail: '已提交资料已回填，可按审核意见修改后重新提交',
    materialsTitle: '上次提交的资料',
    materialsDetail: '原申请资料将在编辑页回填；是否通过以重新审核结果为准。',
    footerHint: '可在原申请资料上修改后重新提交',
    action: '修改并重新提交',
  } as const
}
