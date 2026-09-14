import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { LinkedState } from '../../../双端演示/src/contract'
import { getLinkedDetailView } from '../../../双端演示/src/detail-config'
import { getLinkedPublishForm, submittedPublishData } from '../../../双端演示/src/publish-config'
import { createLinkedSeed } from '../../../双端演示/src/seed'
import { LinkedCurrentDetailCard } from './LinkedDetailCards'
import { findLinkedGoodsForDetail } from './linkedDetailViewModel'

function linkedState(): LinkedState {
  const seed = createLinkedSeed()
  return {
    ...seed,
    titleConfigs: seed.titleConfigs ?? [], publishConfigs: seed.publishConfigs ?? [], detailConfigs: seed.detailConfigs ?? [], searchConfigs: seed.searchConfigs ?? [],
    sessionId: 'detail-user-integration', revision: 1, media: {},
    seller: {
      id: 'linked_seller_001', displayName: '联动演示卖家', status: 'APPROVED', contractStatus: 'SIGNED',
      rowVersion: 1, application: null, applicationId: null, reviewReason: '', submittedAt: null, reviewedAt: null,
    },
  }
}

describe('linked detail user integration', () => {
  it('projects the real dwrg baseline from an exact publish snapshot and preserves numeric zero', () => {
    const state = linkedState()
    const form = getLinkedPublishForm(state, 'dwrg')
    expect(form.mode).toBe('CONFIGURED')
    const values = Object.fromEntries(form.sections.flatMap((section) => section.fields).map((field) => [
      field.fieldKey,
      field.valueType === 'NUMBER' ? 0 : field.options[0].id,
    ]))
    const publish = submittedPublishData(state, 'dwrg', {
      publishVersionId: form.versionId, publishSchemaHash: form.schemaHash, formValues: values,
    })
    expect(publish.publishSnapshot).toBeDefined()

    const view = getLinkedDetailView(state, { gameCode: 'dwrg', publishSnapshot: publish.publishSnapshot })
    expect(view).toMatchObject({ mode: 'CONFIGURED', dataMode: 'SNAPSHOT' })
    expect(view.sections.flatMap((section) => section.fields).map((field) => [field.label, field.displayValue]))
      .toEqual([['系统平台', form.sections[0].fields[0].options[0].name], ['时装数量', '0']])
    const html = renderToStaticMarkup(<LinkedCurrentDetailCard view={view} />)
    expect(html.indexOf('系统平台')).toBeLessThan(html.indexOf('时装数量'))
    expect(html).toContain('<span>0</span>')
  })

  it('does not fall back across games when wzry is blocked or sjzxd has no published baseline', () => {
    const state = linkedState()
    const blocked = getLinkedDetailView(state, { gameCode: 'wzry', publishSnapshot: undefined })
    expect(blocked.mode).toBe('BLOCKED')
    expect(blocked.sections).toEqual([])
    expect(blocked.issues.join('；')).toContain('缺少已启用的枚举选项')

    const missing = getLinkedDetailView(state, { gameCode: 'sjzxd', publishSnapshot: undefined })
    expect(missing).toMatchObject({ mode: 'MISSING', dataMode: 'UNAVAILABLE', sections: [] })
    expect(renderToStaticMarkup(<LinkedCurrentDetailCard view={missing} />)).toContain('暂无已发布详情配置')
  })

  it('resolves detail facts by entity id and never by a colliding public goods number', () => {
    const state = linkedState()
    const target = state.goods[0]
    const collision = { ...target, id: 'another-entity', goodsNo: target.id }
    state.goods = [collision, target]
    expect(findLinkedGoodsForDetail(state, target.id)).toBe(target)
    expect(findLinkedGoodsForDetail({ goods: [collision] }, target.id)).toBeUndefined()
  })
})
