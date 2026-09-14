import { describe, expect, it } from 'vitest'
import { maskRealName, maskRealNameId, parseRealNameScenario, validateRealName } from './realNameModel'

describe('realNameModel', () => {
  it('脱敏姓名和身份证号', () => {
    expect(maskRealName('邓小明')).toBe('邓**')
    expect(maskRealNameId('420101199001012214')).toBe('4201*********214')
    expect(maskRealNameId('123')).toBe('—')
  })

  it('校验输入并安全解析展示场景', () => {
    expect(validateRealName('', '123')).toEqual({ name: '请填写姓名', citizenId: '身份证号码格式不正确' })
    expect(validateRealName('邓小明', '420101199001012214')).toEqual({ name: '', citizenId: '' })
    expect(parseRealNameScenario('reviewing')).toBe('reviewing')
    expect(parseRealNameScenario('other')).toBe('success')
  })
})
