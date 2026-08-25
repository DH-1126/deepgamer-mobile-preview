export type ServerOption = 'all' | 'qq' | 'wechat' | 'steam'
export type ToolbarSelection = 'default' | 'server' | 'price'

export const serverPlatforms: Record<ServerOption, string[]> = {
  all: [],
  qq: ['安卓QQ', 'iOS QQ'],
  wechat: ['安卓微信', 'iOS 微信'],
  steam: ['Steam'],
}

export const pricePresets = [
  { id: '530-850', min: '530', max: '850', share: '42%选择' },
  { id: '850-2000', min: '850', max: '2000', share: '46%选择' },
  { id: '2000-3500', min: '2000', max: '3500', share: '12%选择' },
] as const

export function getServerOption(platforms: string[]): ServerOption {
  if (!platforms.length) return 'all'
  if (platforms.every((platform) => platform.includes('QQ'))) return 'qq'
  if (platforms.every((platform) => platform.includes('微信'))) return 'wechat'
  if (platforms.every((platform) => platform.toLowerCase() === 'steam')) return 'steam'
  return 'all'
}

export function getPricePreset(min: string, max: string) {
  return pricePresets.find((preset) => preset.min === min && preset.max === max)?.id ?? null
}

export function hasInvalidPriceRange(min: string, max: string) {
  return Boolean(min && max && Number(min) > Number(max))
}

export function getToolbarActiveState(selection: ToolbarSelection) {
  return {
    default: selection === 'default',
    server: selection === 'server',
    price: selection === 'price',
  }
}
