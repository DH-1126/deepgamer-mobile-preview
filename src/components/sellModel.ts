import type { RecycleFormInput, RecycleMaterial, RecycleStage } from '../types/recycle'
import type { Recycler, SellGame, SellGameCode } from '../types/sell'

export function filterSellGames(games: SellGame[], query: string) {
  const value = query.trim().toLocaleLowerCase('zh-CN')
  return value ? games.filter((game) => game.name.toLocaleLowerCase('zh-CN').includes(value) || game.code.includes(value)) : games
}

export function availableRecyclers(recyclers: Recycler[], gameCode: SellGameCode) {
  return recyclers.filter((recycler) => recycler.supportedGames.includes(gameCode))
}

export function validateConsultationText(value: string) {
  const text = value.trim()
  if (!text) return '请输入账号情况'
  if (text.length > 500) return '内容不能超过500字'
  if (/(密码|验证码|身份证|银行卡|vx|微信号|qq号[:：]?\s*\d{5,})/i.test(text)) return '咨询阶段请勿发送密码、验证码、实名材料或站外联系方式'
  return ''
}

export function incompleteMaterials(materials: RecycleMaterial[]) {
  return materials.filter((item) => !item.completed).length
}

export function canAdvanceStage(stage: RecycleStage, action: 'offer' | 'accept' | 'materials' | 'confirm' | 'submit' | 'inspect' | 'complete' | 'reject') {
  const transitions: Record<RecycleStage, string[]> = {
    consulting: ['offer'], offered: ['accept', 'reject'], materials: ['materials', 'reject'], formal: ['confirm', 'reject'], submitted: ['inspect'], inspecting: ['complete'], completed: [], rejected: [],
  }
  return transitions[stage].includes(action)
}

export function maskLoginAccount(value: string) {
  const text = value.trim()
  if (text.length <= 4) return '*'.repeat(text.length)
  return `${text.slice(0, 2)}${'*'.repeat(Math.max(3, text.length - 4))}${text.slice(-2)}`
}

export function validateRecycleForm(input: RecycleFormInput) {
  const errors: Partial<Record<keyof RecycleFormInput, string>> = {}
  if (!/^\d{5,12}$/.test(input.loginAccount.trim())) errors.loginAccount = '请输入5至12位 QQ 号（本地仅保存脱敏结果）'
  if (!/^\d{6,12}$/.test(input.campId.trim())) errors.campId = '请输入有效的营地 ID'
  if (input.canRealname === null) errors.canRealname = '请选择是否能二次实名'
  if (input.screenshotCount < 1) errors.screenshotCount = '请至少添加1张账号截图'
  if (input.screenshotCount > 6) errors.screenshotCount = '最多添加6张账号截图'
  if (input.note.length > 200) errors.note = '补充说明不能超过200字'
  if (!input.acceptedRules) errors.acceptedRules = '请阅读并同意账号回收规则'
  return errors
}

export function formatRecycleCountdown(expiresAt: number, now: number) {
  const seconds = Math.max(0, Math.floor((expiresAt - now) / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

