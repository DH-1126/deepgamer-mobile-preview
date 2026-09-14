export type RealNameScenario = 'fill' | 'confirm' | 'submitting' | 'reviewing' | 'success' | 'rejected' | 'failure'

export function maskRealName(value: string) {
  const text = value.trim()
  if (!text) return '—'
  return `${text.slice(0, 1)}${'*'.repeat(Math.max(1, text.length - 1))}`
}

export function maskRealNameId(value: string) {
  const text = value.trim()
  if (text.length !== 18) return '—'
  return `${text.slice(0, 4)}*********${text.slice(-3)}`
}

export function parseRealNameScenario(value: string | null, fallback: RealNameScenario = 'success'): RealNameScenario {
  if (value === 'fill' || value === 'confirm' || value === 'submitting' || value === 'reviewing' || value === 'success' || value === 'rejected' || value === 'failure') return value
  return fallback
}

export function validateRealName(name: string, citizenId: string) {
  return {
    name: /^[\u3400-\u9fff·]{2,20}$/.test(name.trim()) ? '' : '请填写姓名',
    citizenId: /^\d{17}[\dXx]$/.test(citizenId.trim()) ? '' : '身份证号码格式不正确',
  }
}
