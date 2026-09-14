export type RealNameStatus = 'unverified' | 'reviewing' | 'verified' | 'rejected'
export type PasswordScenario = 'fill' | 'countdown' | 'validation' | 'confirm' | 'submitting' | 'success' | 'failure'
export type PasswordMode = 'setup' | 'change'

export interface PasswordValidation {
  currentPassword?: string
  password?: string
  confirmation?: string
  code?: string
}

export function parseRealNameStatus(value: string | null): RealNameStatus {
  if (value === 'unverified' || value === 'reviewing' || value === 'rejected') return value
  return 'verified'
}

export function parsePasswordScenario(value: string | null): PasswordScenario {
  if (value === 'countdown' || value === 'validation' || value === 'confirm' || value === 'submitting' || value === 'success' || value === 'failure') return value
  return 'fill'
}

export function passwordRequirements(password: string, confirmation: string) {
  return {
    length: password.length >= 8 && password.length <= 18,
    composition: /[A-Za-z]/.test(password) && /\d/.test(password),
    matches: Boolean(password) && password === confirmation,
  }
}

export function validatePasswordForm(password: string, confirmation: string, code: string, options?: { mode: PasswordMode; currentPassword: string }): PasswordValidation {
  const checks = passwordRequirements(password, confirmation)
  const errors: PasswordValidation = {}
  if (options?.mode === 'change' && !options.currentPassword.trim()) errors.currentPassword = '请输入原密码'
  if (!checks.length || !checks.composition) errors.password = '密码需为 8-18 位，并同时包含字母和数字'
  if (!confirmation || !checks.matches) errors.confirmation = '两次输入的密码不一致'
  if (!code) errors.code = '请输入验证码'
  else if (!/^\d{4}$/.test(code)) errors.code = '验证码错误，请重新输入'
  return errors
}

export function hasPasswordErrors(errors: PasswordValidation) {
  return Boolean(errors.currentPassword || errors.password || errors.confirmation || errors.code)
}
