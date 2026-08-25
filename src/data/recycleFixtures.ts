import type { Recycler } from '../types/sell'
import type { RecycleOrder } from '../types/recycle'

export const SELL_SELECTION_STORAGE_KEY = 'deepgamer.sell.selection.v1'
export const RECYCLE_STORAGE_KEY = 'deepgamer.recycle.v1'

export function createRecycleOrder(recycler: Recycler, now: number): RecycleOrder {
  return {
    id: `RC-${new Date(now).getFullYear().toString().slice(-2)}08-4471`,
    gameCode: 'wzry', gameName: '王者荣耀', server: 'QQ区', rank: '星耀2',
    recyclerId: recycler.id, recyclerName: recycler.name, quoteCents: 20_000,
    stage: 'consulting', expiresAt: now + 30 * 60 * 1000, createdAt: now, updatedAt: now,
    materials: [
      { key: 'camp_id', label: '营地 ID', detail: '用于核对账号角色', completed: true, value: '88412903' },
      { key: 'battle_screenshot', label: '战绩页截图', detail: '用于核对段位与实名状态', completed: false },
      { key: 'platform_binding', label: '是否绑定过其他平台', detail: '请选择实际情况', completed: false },
    ],
    messages: [
      { id: 'm1', sender: 'recycler', content: '你好，帮你估价。账号是哪个区服？', createdAt: now - 360_000 },
      { id: 'm2', sender: 'user', content: 'QQ区', createdAt: now - 330_000 },
      { id: 'm3', sender: 'recycler', content: '营地 ID 发我一下，我看下段位和皮肤。', createdAt: now - 280_000 },
      { id: 'm4', sender: 'user', content: '88412903', createdAt: now - 240_000 },
      { id: 'm5', sender: 'recycler', content: '看到了，星耀 2。号主是成年人吗？账号有没有封禁或限制？', createdAt: now - 180_000 },
      { id: 'm6', sender: 'user', content: '成年，没有封禁，可以二次实名', createdAt: now - 120_000 },
      { id: 'm7', sender: 'recycler', content: '好的，最后补充战绩页截图，我给你出价。', createdAt: now - 60_000 },
    ],
  }
}
