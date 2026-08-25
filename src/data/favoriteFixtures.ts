import type { FavoriteRecord } from '../types/favorite'

export const FAVORITES_STORAGE_KEY = 'deepgamer.favorites.v1'
export const LEGACY_FAVORITE_PREFIX = 'favorite:'

export function createDefaultFavoriteRecords(now: number): FavoriteRecord[] {
  return [
    { productId: '1', favoritedAt: now - 3 * 86_400_000, statusSnapshot: 'on_sale' },
    { productId: '2114872829163482747', favoritedAt: now - 20 * 86_400_000, statusSnapshot: 'sold' },
  ]
}
