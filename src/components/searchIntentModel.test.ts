import { describe, expect, it } from 'vitest'
import { catalogUrlFromSearchIntent, filtersFromSearchIntent, recognizeSearchIntent, relaxationLabel } from './searchIntentModel'

describe('search intent model', () => {
  it('空搜索默认没有识别内容', () => {
    expect(recognizeSearchIntent('  ').conditions).toEqual([])
  })

  it('识别游戏、英雄、段位和价格区间', () => {
    const intent = recognizeSearchIntent('王者 108英雄 王者段位 500-1500')
    expect(intent.gameCode).toBe('wzry')
    expect(intent.conditions.map((item) => [item.kind, item.value])).toEqual([
      ['game', '王者荣耀'],
      ['hero', '≥108'],
      ['rank', '王者'],
      ['price', '¥500-1500'],
    ])
  })

  it('识别全皮肤、贵族与预算，并生成可用筛选', () => {
    const intent = recognizeSearchIntent('王者 全皮肤 贵族15 预算500')
    expect(filtersFromSearchIntent(intent)).toMatchObject({ minSkin: '700', eliteLevels: ['V15'], maxPrice: '500' })
  })

  it('删除单条条件后不会把它写入目录链接', () => {
    const intent = recognizeSearchIntent('和平精英 满级 预算850 QQ区')
    const url = catalogUrlFromSearchIntent(intent, ['price'])
    expect(url).toContain('gameCode=hpjy')
    expect(url).toContain('platforms=')
    expect(url).not.toContain('maxPrice=')
  })

  it('价格放宽建议优先展示目标预算', () => {
    const condition = recognizeSearchIntent('王者预算500').conditions.find((item) => item.kind === 'price')!
    expect(relaxationLabel(condition, 3800)).toBe('预算提高到 ¥3,800')
  })
})
