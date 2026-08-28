import { describe, expect, it } from 'vitest'
import type { RecycleStorage } from './recycleRepository'
import { createRecycleRepository } from './recycleRepository'

function storage(fail = false): RecycleStorage { const data = new Map<string, string>(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { if (fail) throw new Error('quota'); data.set(key, value) }, removeItem: (key) => { data.delete(key) } } }

describe('recycleRepository', () => {
  it('完整推进咨询、报价、补资料、提交和验号成功', () => {
    let now = 2_000_000_000_000
    const repository = createRecycleRepository({ storage: storage(), now: () => ++now })
    const order = repository.begin('fun')!
    expect(repository.get(order.id)?.id).toBe(order.id)
    expect(repository.get('RC-NOT-FOUND')).toBeUndefined()
    expect(repository.acceptOffer(order.id)).toBe(false)
    expect(repository.receiveOffer(order.id)).toBe(true)
    expect(repository.acceptOffer(order.id)).toBe(true)
    expect(repository.createFormalOrder(order.id)).toBe(false)
    repository.setMaterial(order.id, 'battle_screenshot', '1张')
    repository.setMaterial(order.id, 'platform_binding', '没有')
    expect(repository.createFormalOrder(order.id)).toBe(true)
    expect(repository.confirmOrder(order.id)).toBe(true)
    expect(repository.submit(order.id, { loginAccount: '123456789', campId: '88412903', canRealname: true, screenshotCount: 1, note: '', acceptedRules: true })).toBe(true)
    expect(repository.getActive()?.submission?.maskedLoginAccount).toBe('12*****89')
    expect(JSON.stringify(repository.getActive())).not.toContain('123456789')
    expect(repository.startInspection(order.id)).toBe(true)
    expect(repository.complete(order.id)).toBe(true)
    expect(repository.getActive()?.stage).toBe('completed')
  })

  it('写入失败时不伪造成功状态', () => {
    const repository = createRecycleRepository({ storage: storage(true) })
    expect(repository.begin('fun')).toBeUndefined()
  })
})
