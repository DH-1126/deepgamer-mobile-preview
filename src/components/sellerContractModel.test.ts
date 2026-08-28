import { describe, expect, it } from 'vitest'
import { createSubmittedSellerApplication, isBusinessLicense, isChineseName, isCitizenId, isMainlandPhone } from './sellerContractModel'

describe('sellerContractModel', () => {
  it('校验卖家签约中的基础身份字段', () => {
    expect(isChineseName('王小明')).toBe(true)
    expect(isChineseName('A')).toBe(false)
    expect(isMainlandPhone('13800138000')).toBe(true)
    expect(isMainlandPhone('12345')).toBe(false)
    expect(isCitizenId('11010119900101123X')).toBe(true)
    expect(isCitizenId('110101')).toBe(false)
    expect(isBusinessLicense('91310000MA1K123456')).toBe(true)
    expect(isBusinessLicense('ABC')).toBe(false)
  })

  it('提交快照只保存主体、状态和时间', () => {
    expect(createSubmittedSellerApplication('personal', 123)).toEqual({ status: 'under_review', subject: 'personal', submittedAt: 123 })
  })
})
