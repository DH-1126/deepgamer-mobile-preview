import { DEMO_CODE } from '../data/authFixtures'

export const DEFAULT_NICKNAME = '玩家_8471'
export const DEFAULT_ACCOUNT_PHONE = '187****8033'
export function validateNickname(value: string) {
  const name = value.trim()
  if (!name) return '请输入昵称'
  if ([...name].length > 20) return '昵称最多 20 个字符'
  if (/[\u0000-\u001f\u007f]/.test(name)) return '昵称不能包含换行或控制字符'
  return ''
}
export function validateAvatarFile(file: Pick<File, 'type' | 'size'>) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return '请选择 JPG、PNG 或 WebP 图片'
  if (!file.size || file.size > 2 * 1024 * 1024) return '图片大小需在 2MB 以内'
  return ''
}
export function validateNewPhone(phone: string) { return /^1[3-9]\d{9}$/.test(phone) ? '' : '请输入正确的 11 位手机号' }
export function maskAccountPhone(phone: string) { return `${phone.slice(0, 3)}****${phone.slice(-4)}` }
export type PhoneChallenge = { target: string; expiresAt: number; resendAt: number }
export function validatePhoneChallenge(challenge: PhoneChallenge | null, target: string, code: string, now: number) {
  if (!challenge || challenge.target !== target) return '请先获取当前手机号的验证码'
  if (now >= challenge.expiresAt) return '验证码已过期，请重新获取'
  if (code !== DEMO_CODE) return '验证码错误，请重新输入'
  return ''
}
