export type SellGameCode = 'wzry' | 'peace' | 'genshin' | 'delta' | 'identity' | 'valorant' | 'egg' | 'starrail' | 'naruto'

export type SellGame = {
  code: SellGameCode
  name: string
  mark: string
  consultationCount: number
  featured?: boolean
  color: string
}

export type RecyclerAvailability = 'online' | 'offline'

export type Recycler = {
  id: string
  name: string
  mark: string
  availability: RecyclerAvailability
  averageResponseMinutes?: number
  serviceTime: string
  description: string
  tags: string[]
  supportedGames: SellGameCode[]
}

export type SellSelection = {
  gameCode: SellGameCode | null
  recyclerId: string | null
  updatedAt: number
}

