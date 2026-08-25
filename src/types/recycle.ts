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
  sender: 'user' | 'recycler' | 'system'
  content: string
  createdAt: number
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
  quoteCents: number
  stage: RecycleStage
  expiresAt: number
  createdAt: number
  updatedAt: number
  materials: RecycleMaterial[]
  messages: RecycleMessage[]
  submission?: RecycleSubmission
}

export type RecycleStore = {
  activeOrderId: string | null
  orders: RecycleOrder[]
}

