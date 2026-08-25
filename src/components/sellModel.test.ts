import { describe, expect, it } from 'vitest'
import { createRecycleOrder } from '../data/recycleFixtures'
import { recyclerFixtures, sellGames } from '../data/sellFixtures'
import { availableRecyclers, canAdvanceStage, filterSellGames, incompleteMaterials, maskLoginAccount, validateConsultationText, validateRecycleForm } from './sellModel'

describe('sellModel', () => {
  it('支持游戏搜索并只返回支持该游戏的回收商', () => {
    expect(filterSellGames(sellGames, '王者').map((item) => item.code)).toEqual(['wzry'])
    expect(availableRecyclers(recyclerFixtures, 'wzry')).toHaveLength(4)
    expect(availableRecyclers(recyclerFixtures, 'delta')).toHaveLength(0)
  })

  it('阻止咨询阶段发送敏感信息', () => {
    expect(validateConsultationText('')).toBe('请输入账号情况')
    expect(validateConsultationText('我的密码是 123456')).toContain('请勿发送')
    expect(validateConsultationText('86皮肤，可以二次实名')).toBe('')
  })

  it('状态只能按回收流程推进', () => {
    expect(canAdvanceStage('consulting', 'offer')).toBe(true)
    expect(canAdvanceStage('consulting', 'submit')).toBe(false)
    expect(canAdvanceStage('formal', 'confirm')).toBe(true)
  })

  it('校验回收资料并脱敏登录账号', () => {
    const errors = validateRecycleForm({ loginAccount: '12', campId: '', canRealname: null, screenshotCount: 0, note: '', acceptedRules: false })
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['loginAccount', 'campId', 'canRealname', 'screenshotCount', 'acceptedRules']))
    expect(maskLoginAccount('123456789')).toBe('12*****89')
    expect(incompleteMaterials(createRecycleOrder(recyclerFixtures[0], Date.now()).materials)).toBe(2)
  })
})
