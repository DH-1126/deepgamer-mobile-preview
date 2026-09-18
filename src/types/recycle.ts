import type { SellGameCode } from './sell'

export type RecycleStage = 'consulting' | 'offered' | 'materials' | 'formal' | 'submitted' | 'inspecting' | 'completed' | 'rejected'
export type RecycleMaterialKey = 'camp_id' | 'battle_screenshot' | 'platform_binding'

export type RecycleMaterial = {
  key: RecycleMaterialKey
  label: string
  detail: string
  completed: boolean
  value?: string
}

export type RecycleMessage = {
  id: string
  sender: 'user' | 'recycler' | 'system' | 'support'
  content: string
  createdAt: number
  historyCard?: RecycleHistoryCard
}

export type RecycleHistoryCard = {
  state: 'unsent' | 'pending' | 'confirming' | 'rejected' | 'awaiting_payment' | 'preparing_payment' | 'ready_payment' | 'completed' | 'event'
  role: 'seller' | 'recycler'
  orderId: string
  quoteCents: number
  eventType?: string
}

export type RecycleSubmission = {
  maskedLoginAccount: string
  campId: string
  canRealname: boolean
  screenshotCount: number
  note: string
  acceptedRules: boolean
}

export type RecycleFormInput = {
  loginAccount: string
  campId: string
  canRealname: boolean | null
  screenshotCount: number
  note: string
  acceptedRules: boolean
}

export type RecycleOrder = {
  id: string
  gameCode: SellGameCode
  gameName: string
  server: string
  rank: string
  recyclerId: string
  recyclerName: string
  /** Display nickname for the consultation list; independent from recycler identity. */
  contactName?: string
  /** Local unread message count. Missing on legacy records means zero. */
  unreadCount?: number
  /** 完整咨询历史样例；历史报价与操作不可再次提交。 */
  historyPreview?: boolean
  quoteCents: number
  protectionFeeCents?: number
  stage: RecycleStage
  expiresAt: number
  createdAt: number
  updatedAt: number
  materials: RecycleMaterial[]
  messages: RecycleMessage[]
  /** 正式回收单中由回收商填写的账号概况；旧数据可以没有此字段。 */
  formalDraft?: RecycleOrderDraft
  submission?: RecycleSubmission
  /** Created only after the recycler completes the local payment demo. */
  conversationId?: string
  orderId?: string
  sellerConfirmedAt?: number
  paidAt?: number
}

export type RecycleOrderDraft = {
  loginAccount: string
  realnameStatus: '' | '包人脸' | '不包人脸' | '未实名'
  nobleLevel: '' | `V${number}`
  antiAddiction: '' | '有防沉迷' | '无防沉迷'
  quoteCents: number
  screenshots: RecycleDraftScreenshot[]
  note: string
}

export type RecycleDraftScreenshot = {
  id: string
  name: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  size: number
}

export type RecycleStore = {
  activeOrderId: string | null
  orders: RecycleOrder[]
}
