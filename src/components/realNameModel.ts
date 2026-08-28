export function maskRealName(value: string) {
  const text = value.trim()
  if (!text) return '—'
  return `${text.slice(0, 1)}${'*'.repeat(Math.max(1, text.length - 1))}`
}

export function maskRealNameId(value: string) {
  const text = value.trim()
  if (text.length !== 18) return '—'
  return `${text.slice(0, 4)}***********${text.slice(-3)}`
}
