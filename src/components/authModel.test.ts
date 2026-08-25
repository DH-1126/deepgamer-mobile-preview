import { describe, expect, it } from 'vitest'
import { buildLoginRoute, getCountdown, isValidMainlandPhone, maskPhone, normalizeCode, normalizePhone, sanitizeReturnTo } from './authModel'

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
