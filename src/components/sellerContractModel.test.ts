import { describe, expect, it } from 'vitest'
import {
  advanceSellerApplicationStep,
  applySellerPrototypeScenario,
  createSubmittedSellerApplication,
  isBusinessLicense,
  isChineseName,
  isCitizenId,
  isMainlandPhone,
  isRecognizedAddress,
  parseSellerPrototypeScenario,
  withApplicationStatus,
} from './sellerContractModel'
import { TAKEOUT_ORDER_MAX_FILE_SIZE, validateTakeoutOrderImage } from './sellerContractMediaUpload'

describe('sellerContractModel', () => {
  it('prevents a review-step click from submitting the form', () => {
    const calls: string[] = []
    advanceSellerApplicationStep({ preventDefault: () => calls.push('prevent') }, () => calls.push('next'))
    expect(calls).toEqual(['prevent', 'next'])
  })
  it('校验卖家签约中的基础身份字段', () => {
    expect(isChineseName('王小明')).toBe(true)
    expect(isChineseName('A')).toBe(false)
    expect(isMainlandPhone('13800138000')).toBe(true)
    expect(isMainlandPhone('12345')).toBe(false)
    expect(isCitizenId('11010119900101123X')).toBe(true)
    expect(isCitizenId('110101')).toBe(false)
    expect(isBusinessLicense('91310000MA1K123456')).toBe(true)
    expect(isBusinessLicense('ABC')).toBe(false)
    expect(isRecognizedAddress('上海市浦东新区示例路 1 号')).toBe(true)
    expect(isRecognizedAddress('短址')).toBe(false)
  })

  it('提交快照只携带非敏感流程标记与外卖订单媒体 ID', () => {
    expect(createSubmittedSellerApplication('business', 'local_takeout_demo', 123, 'company')).toEqual({
      status: 'under_review', subject: 'business', entityType: 'company', takeoutOrderMediaId: 'local_takeout_demo', submittedAt: 123,
    })
  })

  it('状态转换不会为未选择主体的申请伪造审核状态', () => {
    expect(withApplicationStatus({ status: 'not_started', subject: null }, 'approved')).toEqual({ status: 'not_started', subject: null })
    expect(withApplicationStatus({ status: 'under_review', subject: 'personal' }, 'approved').status).toBe('approved')
  })

  it('仅接受显式原型场景并将场景映射为体验状态', () => {
    expect(parseSellerPrototypeScenario('buyer')).toBe('buyer')
    expect(parseSellerPrototypeScenario('not_started')).toBe('buyer')
    expect(parseSellerPrototypeScenario('approved')).toBe('approved')
    expect(parseSellerPrototypeScenario('failed')).toBe('rejected')
    expect(parseSellerPrototypeScenario('under_review')).toBe('review')
    expect(parseSellerPrototypeScenario('unknown')).toBeNull()
    expect(applySellerPrototypeScenario({ status: 'not_started', subject: null }, 'rejected')).toEqual({ status: 'changes_requested', subject: 'personal' })
    expect(applySellerPrototypeScenario({ status: 'active', subject: 'personal' }, 'buyer')).toEqual({ status: 'not_started', subject: null })
  })

  it('校验外卖订单截图格式和 10MB 限制', () => {
    expect(validateTakeoutOrderImage({ type: 'image/jpeg', size: TAKEOUT_ORDER_MAX_FILE_SIZE })).toBe('')
    expect(validateTakeoutOrderImage({ type: 'image/png', size: 128 })).toBe('')
    expect(validateTakeoutOrderImage({ type: 'image/webp', size: 128 })).toBe('仅支持 JPG、PNG 格式图片')
    expect(validateTakeoutOrderImage({ type: 'image/jpeg', size: TAKEOUT_ORDER_MAX_FILE_SIZE + 1 })).toBe('图片大小不能超过 10MB')
  })
})
