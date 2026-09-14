import { describe, expect, it } from 'vitest'
import { DEMO_CODE } from '../data/authFixtures'
import { maskAccountPhone, validateAvatarFile, validateNewPhone, validateNickname, validatePhoneChallenge } from './profileIdentityModel'

describe('profile editing validation', () => {
  it('rejects empty, too long and multiline names, allowing normal and emoji names', () => {
    for (const value of ['', '   ', '玩'.repeat(21), '玩家\n测试']) expect(validateNickname(value)).not.toBe('')
    expect(validateNickname(' 玩家 🎮 ')).toBe('')
    expect(validateNickname('🎮'.repeat(20))).toBe('')
  })
  it('limits avatars to supported nonempty images up to 2MB', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 2 * 1024 * 1024 })).toBe('')
    for (const file of [{ type: 'image/svg+xml', size: 20 }, { type: 'image/jpeg', size: 0 }, { type: 'image/webp', size: 2097153 }]) expect(validateAvatarFile(file)).not.toBe('')
  })
  it('requires requesting a matching nonexpired code, then masks the phone for storage', () => {
    const target = '13800000000' // Fictional demo input.
    const challenge = { target, resendAt: 60000, expiresAt: 300000 }
    expect(validateNewPhone(target)).toBe('')
    expect(validateNewPhone('123')).not.toBe('')
    expect(maskAccountPhone(target)).toBe('138****0000')
    expect(validatePhoneChallenge(null, target, DEMO_CODE, 1)).not.toBe('')
    expect(validatePhoneChallenge(challenge, 'new-target', DEMO_CODE, 1)).not.toBe('')
    expect(validatePhoneChallenge(challenge, target, '000000', 1)).not.toBe('')
    expect(validatePhoneChallenge(challenge, target, DEMO_CODE, 300000)).not.toBe('')
    expect(validatePhoneChallenge(challenge, target, DEMO_CODE, 299999)).toBe('')
  })
})
