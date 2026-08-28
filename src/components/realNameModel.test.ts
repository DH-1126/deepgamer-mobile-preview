import { describe, expect, it } from 'vitest'
import { maskRealName, maskRealNameId } from './realNameModel'

describe('realNameModel', () => {
  it('脱敏姓名和身份证号', () => {
    expect(maskRealName('邓小明')).toBe('邓**')
    expect(maskRealNameId('420101199001012214')).toBe('4201***********214')
    expect(maskRealNameId('123')).toBe('—')
  })
})
