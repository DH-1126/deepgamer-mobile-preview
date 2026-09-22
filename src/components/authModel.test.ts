import { describe, expect, it } from 'vitest'
import { buildLoginRoute, formatLoginPhone, getCountdown, getLoginFigmaNodeId, getRecoveryFigmaNodeId, getWelcomeFigmaNodeId, isValidMainlandPhone, maskPhone, normalizeCode, normalizePhone, sanitizeReturnTo } from './authModel'

describe('authModel', () => {
  it('normalizes and validates mainland phone numbers', () => {
    expect(normalizePhone('+86 138-0013-8000')).toBe('13800138000')
    expect(isValidMainlandPhone('138 0013 8000')).toBe(true)
    expect(isValidMainlandPhone('12800138000')).toBe(false)
    expect(maskPhone('13800138000')).toBe('138 **** 8000')
  })

  it('normalizes verification codes', () => {
    expect(normalizeCode('24a68 10')).toBe('246810')
  })

  it('formats the editable phone using the Draft3 groups', () => {
    expect(formatLoginPhone('+86 187-8866-0033')).toBe('187 8866 0033')
    expect(formatLoginPhone('18788')).toBe('187 88')
  })

  it('maps launch and login states to the approved Page 7 Figma frames', () => {
    expect(getWelcomeFigmaNodeId('splash')).toBe('startup:splash')
    expect(getWelcomeFigmaNodeId('loading')).toBe('startup:loading')
    expect(getWelcomeFigmaNodeId('error')).toBe('startup:error')
    expect(getWelcomeFigmaNodeId('agreement')).toBe('7114:921')
    expect(getWelcomeFigmaNodeId('exit')).toBe('7115:947')
    expect(getLoginFigmaNodeId('one_tap')).toBe('7080:144')
    expect(getLoginFigmaNodeId('code')).toBe('7080:202')
    expect(getLoginFigmaNodeId('password')).toBe('7080:274')
    expect(getLoginFigmaNodeId('code', { agreed: false })).toBe('7081:303')
    expect(getLoginFigmaNodeId('code', { codeSent: true })).toBe('7081:485')
    expect(getLoginFigmaNodeId('password', { protocolPrompt: true })).toBe('7081:385')
  })

  it('returns the filled recovery frame after a validation error is corrected', () => {
    expect(getRecoveryFigmaNodeId({})).toBe('7087:620')
    expect(getRecoveryFigmaNodeId({ password: 'Demo2026', errors: { password: undefined } })).toBe('7087:716')
    expect(getRecoveryFigmaNodeId({ password: 'short', errors: { password: '密码格式错误' } })).toBe('7087:831')
    expect(getRecoveryFigmaNodeId({ password: 'Demo2026', pageError: '验证码错误' })).toBe('7087:831')
  })

  it('only permits local safe return paths', () => {
    expect(sanitizeReturnTo('/orders/preview?from=goods#pay')).toBe('/orders/preview?from=goods#pay')
    expect(sanitizeReturnTo('//evil.example')).toBe('/')
    expect(sanitizeReturnTo('https://evil.example')).toBe('/')
    expect(sanitizeReturnTo('/login')).toBe('/')
    expect(sanitizeReturnTo('/login/code')).toBe('/')
  })

  it('builds independent login routes and preserves the intended destination', () => {
    expect(buildLoginRoute('one_tap')).toBe('/login')
    expect(buildLoginRoute('code', '/orders/preview?from=goods')).toBe('/login/code?returnTo=%2Forders%2Fpreview%3Ffrom%3Dgoods')
    expect(buildLoginRoute('one_tap', '/message', '/game?gameCode=wzry')).toBe('/login?returnTo=%2Fmessage&closeTo=%2Fgame%3FgameCode%3Dwzry')
    expect(buildLoginRoute('password')).toBe('/login/password')
  })

  it('calculates a non-negative countdown', () => {
    expect(getCountdown(61_000, 1_000)).toBe(60)
    expect(getCountdown(1_000, 2_000)).toBe(0)
  })
})
