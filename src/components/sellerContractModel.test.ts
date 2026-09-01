import { describe, expect, it } from 'vitest'
import { createSubmittedSellerApplication, isBusinessLicense, isChineseName, isCitizenId, isMainlandPhone } from './sellerContractModel'
import { TAKEOUT_ORDER_MAX_FILE_SIZE, validateTakeoutOrderImage } from './sellerContractMediaUpload'

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

  it('提交快照携带外卖订单媒体 ID', () => {
    expect(createSubmittedSellerApplication('personal', 'local_takeout_demo', 123)).toEqual({
      status: 'under_review',
      subject: 'personal',
      takeoutOrderMediaId: 'local_takeout_demo',
      submittedAt: 123,
    })
  })

  it('校验外卖订单截图格式和 10MB 限制', () => {
    expect(validateTakeoutOrderImage({ type: 'image/jpeg', size: TAKEOUT_ORDER_MAX_FILE_SIZE })).toBe('')
    expect(validateTakeoutOrderImage({ type: 'image/png', size: 128 })).toBe('')
    expect(validateTakeoutOrderImage({ type: 'image/webp', size: 128 })).toBe('仅支持 JPG、PNG 格式图片')
    expect(validateTakeoutOrderImage({ type: 'image/jpeg', size: TAKEOUT_ORDER_MAX_FILE_SIZE + 1 })).toBe('图片大小不能超过 10MB')
  })
})
