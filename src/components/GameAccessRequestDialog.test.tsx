import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GameAccessRequestDialog } from './GameAccessRequestDialog'
import { validateGameAccessRequest } from './sellModel'

describe('game access request dialog', () => {
  it('reuses shared dialog, fields and actions with two required inputs', () => {
    const html = renderToStaticMarkup(<GameAccessRequestDialog onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(html).toContain('data-ui="Dialog"')
    expect(html).toContain('接入更多游戏')
    expect(html.match(/data-ui="TextField"/g)).toHaveLength(2)
    expect(html.match(/required=""/g)).toHaveLength(2)
    expect(html).toContain('游戏名称')
    expect(html).toContain('游戏厂商')
    expect(html).toContain('>取消</button>')
    expect(html).toContain('>提交</button>')
    expect(html).toContain('aria-label="关闭"')
    expect(html).toContain('type="submit"')
  })

  it('rejects whitespace-only input and accepts both filled fields', () => {
    expect(validateGameAccessRequest({ gameName: '  ', manufacturer: '\n' })).toEqual({ gameName: '请输入游戏名称', manufacturer: '请输入游戏厂商' })
    expect(validateGameAccessRequest({ gameName: ' 示例游戏 ', manufacturer: ' 示例厂商 ' })).toEqual({})
    expect(validateGameAccessRequest({ gameName: '游戏', manufacturer: '' })).toEqual({ manufacturer: '请输入游戏厂商' })
  })

  it('enforces the same length boundaries as the input controls', () => {
    expect(validateGameAccessRequest({ gameName: '游'.repeat(40), manufacturer: '厂'.repeat(60) })).toEqual({})
    expect(validateGameAccessRequest({ gameName: '游'.repeat(41), manufacturer: '厂'.repeat(61) })).toEqual({ gameName: '游戏名称不能超过40字', manufacturer: '游戏厂商不能超过60字' })
  })
})
