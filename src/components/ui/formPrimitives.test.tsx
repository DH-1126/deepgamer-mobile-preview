import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { OptionTile, SelectField, TextAreaField } from './index'

describe('shared multiline and native select fields', () => {
  it('links textarea labels and inline errors and reports controlled length', () => {
    const html = renderToStaticMarkup(<TextAreaField id="feedback" label="反馈内容" value="游戏名称" onChange={vi.fn()} maxLength={80} showCount error="请补充厂商" aria-describedby="external" />)
    expect(html).toContain('id="feedback"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="external feedback-help"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('4/80')
  })
  it('keeps native textarea attributes and disabled state', () => {
    const html = renderToStaticMarkup(<TextAreaField aria-label="备注" rows={6} disabled defaultValue="已填写" />)
    expect(html).toContain('rows="6"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('已填写')
  })
  it('renders controlled selected options and disabled choices', () => {
    const html = renderToStaticMarkup(<SelectField label="状态" value="sold" onChange={vi.fn()} compact options={[{ value: '', label: '全部' }, { value: 'sold', label: '已售出' }, { value: 'offline', label: '已下架', disabled: true }]} />)
    expect(html).toContain('dg-form-field__select--compact')
    expect(html).toMatch(/<option value="sold" selected="">已售出/)
    expect(html).toMatch(/<option value="offline" disabled="">已下架/)
  })
  it('also supports semantic option groups without generated options', () => {
    const html = renderToStaticMarkup(<SelectField aria-label="选择游戏"><optgroup label="手游"><option value="wzry">王者荣耀</option></optgroup></SelectField>)
    expect(html).toContain('<optgroup label="手游">')
    expect(html).toContain('aria-label="选择游戏"')
  })
  it('counts an uncontrolled initial value and exposes a rich selectable card', () => {
    const textarea = renderToStaticMarkup(<TextAreaField defaultValue="补充说明" maxLength={50} showCount />)
    expect(textarea).toContain('4/50')
    const tile = renderToStaticMarkup(<OptionTile selected disabled title="产品建议" description="告诉我们你的想法" icon={<span>图</span>} trailing={<span>›</span>} />)
    expect(tile).toContain('data-ui="OptionTile"')
    expect(tile).toContain('aria-pressed="true"')
    expect(tile).toContain('disabled=""')
    expect(tile.match(/<button/g)).toHaveLength(1)
    expect(tile).toContain('type="button"')
    expect(tile).toContain('告诉我们你的想法')
  })
})
