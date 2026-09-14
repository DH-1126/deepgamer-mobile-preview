import { describe, expect, it } from 'vitest'
import { hasPasswordErrors, parsePasswordScenario, parseRealNameStatus, passwordRequirements, validatePasswordForm } from './accountSettingsModel'

describe('accountSettingsModel', () => {
  it('仅接受设计稿声明的预览状态', () => {
    expect(parseRealNameStatus('reviewing')).toBe('reviewing')
    expect(parseRealNameStatus('unknown')).toBe('verified')
    expect(parsePasswordScenario('failure')).toBe('failure')
    expect(parsePasswordScenario('unknown')).toBe('fill')
  })

  it('按 8-18 位、字母数字组合和二次确认校验密码', () => {
    expect(passwordRequirements('Abcd1234', 'Abcd1234')).toEqual({ length: true, composition: true, matches: true })
    const errors = validatePasswordForm('12345', '1234', '')
    expect(errors).toEqual({
      password: '密码需为 8-18 位，并同时包含字母和数字',
      confirmation: '两次输入的密码不一致',
      code: '请输入验证码',
    })
    expect(hasPasswordErrors(errors)).toBe(true)
    expect(hasPasswordErrors(validatePasswordForm('Abcd1234', 'Abcd1234', '8241'))).toBe(false)
  })

  it('only requires the old password in change mode, without verifying a real credential', () => {
    const values = ['Abcd1234', 'Abcd1234', '8241'] as const
    expect(validatePasswordForm(...values, { mode: 'setup', currentPassword: '' })).toEqual({})
    expect(validatePasswordForm(...values, { mode: 'change', currentPassword: '' })).toEqual({ currentPassword: '请输入原密码' })
    expect(hasPasswordErrors({ currentPassword: '请输入原密码' })).toBe(true)
    expect(validatePasswordForm(...values, { mode: 'change', currentPassword: 'demo-only' })).toEqual({})
  })
})
