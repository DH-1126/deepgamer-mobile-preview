export type ProfileRole = 'buyer' | 'seller'
export type ProfileOrderStatus = 'pending' | 'binding' | 'bind_success' | 'aftersale' | 'on_sale' | 'reviewing'

export type ProfileUser = {
  name: string
  managementId: string
  loginStatus: '已登录'
  balanceCents: number
  favoriteCount: number
}

export type ProfileOrder = {
  id: string
  role: ProfileRole
  status: ProfileOrderStatus
  expiresAt?: number
}

export type ProfileEntry = {
  label: string
  route?: string
  action?: 'recycle'
  badge?: string
  dot?: boolean
}
