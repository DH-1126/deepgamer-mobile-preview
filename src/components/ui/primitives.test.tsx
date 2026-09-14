import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { BottomSheet, Button, Cell, Checkbox, ChoiceChip, CountBadge, Dialog, FilterTrigger, RangeField, SearchField, StatusBadge, Tabs, TextField, Toast, ToggleSwitch } from './index'

describe('ui primitives', () => {
  it('supports a two-line choice without changing selection semantics', () => {
    const html = renderToStaticMarkup(<ChoiceChip selected showCheck description="42%选择">530–850</ChoiceChip>)
    expect(html).toContain('dg-choice-chip--descriptive')
    expect(html).toContain('dg-choice-chip__description')
    expect(html).toContain('42%选择')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('dg-choice-chip__check')
  })

  it('renders semantic button variants and loading state', () => {
    const html = renderToStaticMarkup(<Button loading variant="primary" size="xl">提交</Button>)
    expect(html).toContain('data-ui="Button"')
    expect(html).toContain('dg-button--xl')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('disabled=""')
  })

  it('keeps selection, form labels and range names accessible', () => {
    const html = renderToStaticMarkup(<><ChoiceChip selected showCheck>已选</ChoiceChip><TextField label="手机号" value="138" readOnly /><SearchField aria-label="搜索商品" value="王者" onClear={() => undefined} readOnly /><RangeField label="价格" min="100" max="20" onChange={() => undefined} /><Checkbox checked label="同意协议" onCheckedChange={() => undefined} /></>)
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('手机号')
    expect(html).toContain('aria-label="价格最低"')
    expect(html).toContain('最低值不能高于最高值')
    expect(html).toContain('type="checkbox"')
  })

  it('renders filter trigger expansion and active styles from one primitive', () => {
    const html = renderToStaticMarkup(<FilterTrigger active expanded>最近 7 天</FilterTrigger>)
    expect(html).toContain('data-ui="FilterTrigger"')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('dg-filter-trigger--highlighted')
    expect(html).toContain('dg-filter-trigger--expanded')
    expect(html).toContain('chevron-dark.svg')
  })

  it('keeps an explicit search action for empty queries without a cancel action or nested form', () => {
    const html = renderToStaticMarkup(<SearchField value="" readOnly onSearch={() => undefined} />)
    expect(html).toContain('dg-search-control')
    expect(html).toContain('enterKeyHint="search"')
    expect(html).toContain('type="button"')
    expect(html).toContain('>搜索</button>')
    expect(html).not.toContain('取消')
    expect(html).not.toContain('<form')
  })

  it('uses explicit status tones and hides zero counts', () => {
    const html = renderToStaticMarkup(<><StatusBadge tone="warning">处理中</StatusBadge><CountBadge count={0} /><CountBadge count={120} /></>)
    expect(html).toContain('dg-status-badge--warning')
    expect(html).not.toContain('>0<')
    expect(html).toContain('99+')
    expect(html).toContain('aria-label="120项"')
  })

  it('renders a non-interactive brand badge with a decorative icon', () => {
    const html = renderToStaticMarkup(<StatusBadge tone="brand" icon={<svg />}>平台客服</StatusBadge>)
    expect(html).toContain('dg-status-badge--brand')
    expect(html).toContain('class="dg-status-badge__icon" aria-hidden="true"')
    expect(html).toContain('平台客服')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('aria-pressed')
  })

  it('renders routed and interactive cells with one trailing affordance', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/"><><Cell label="设置" to="/settings" /><Cell label="开关" onClick={() => undefined} trailing="已开启" /></></StaticRouter>)
    expect(html).toContain('href="/settings"')
    expect(html).toContain('<button')
    expect(html.match(/dg-cell__arrow/g)?.length).toBe(1)
  })

  it('exposes tabs and switch semantics', () => {
    const html = renderToStaticMarkup(<><Tabs label="订单状态" panelId="order-panel" value="all" onValueChange={() => undefined} items={[{ value: 'all', label: '全部' }, { value: 'done', label: '已完成', disabled: true }]} /><ToggleSwitch checked label="个性化推荐" onCheckedChange={() => undefined} showLabel /></>)
    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('role="switch"')
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('aria-controls="order-panel"')
  })

  it('keeps a usable tab stop when the supplied value is not available', () => {
    const html = renderToStaticMarkup(<Tabs label="订单状态" value="missing" onValueChange={() => undefined} items={[{ value: 'disabled', label: '禁用', disabled: true }, { value: 'all', label: '全部' }]} />)
    expect(html).toContain('>全部</button>')
    expect(html).toContain('tabindex="0"')
  })

  it('links each scroll section tab to its own panel', () => {
    const html = renderToStaticMarkup(<Tabs label="详情导航" value="description" panelId="fallback" onValueChange={() => undefined} items={[{ value: 'description', label: '描述', panelId: 'description-panel' }, { value: 'assets', label: '资产', panelId: 'assets-panel' }]} />)
    expect(html).toContain('aria-controls="description-panel"')
    expect(html).toContain('aria-controls="assets-panel"')
    expect(html).not.toContain('aria-controls="fallback"')
  })

  it('supports secondary indicators and compact wrapping ratios without changing selection semantics', () => {
    const html = renderToStaticMarkup(<><Tabs label="资产类型" variant="underline-secondary" value="hero" onValueChange={() => undefined} items={[{ value: 'hero', label: '英雄' }]} /><Tabs label="职业" size="sm" wrap value="mage" onValueChange={() => undefined} items={[{ value: 'mage', label: '法师', count: '21/24' }]} /></>)
    expect(html).toContain('dg-tabs--underline dg-tabs--underline-secondary')
    expect(html).toContain('dg-tabs--sm dg-tabs--wrap')
    expect(html).toContain('21/24')
    expect(html.match(/aria-selected="true"/g)).toHaveLength(2)
  })

  it('supports larger primary and regular secondary tabs through shared size variants', () => {
    const html = renderToStaticMarkup(<><Tabs label="主分区" size="lg" variant="underline" value="assets" onValueChange={() => undefined} items={[{ value: 'assets', label: '资产' }, { value: 'description', label: '描述' }]} /><Tabs label="分类" size="md" variant="underline" value="hero" onValueChange={() => undefined} items={[{ value: 'hero', label: '英雄' }, { value: 'skins', label: '皮肤' }]} /></>)
    expect(html).toContain('dg-tabs--underline dg-tabs--lg')
    expect(html).toContain('dg-tabs--underline dg-tabs--md')
    expect(html.match(/aria-selected="true"/g)).toHaveLength(2)
    expect(html.match(/aria-selected="false"/g)).toHaveLength(2)
  })

  it('renders configured overlays and does not render an empty toast', () => {
    const hidden = renderToStaticMarkup(<><Dialog open={false} onClose={() => undefined} title="提示">内容</Dialog><BottomSheet open={false} onClose={() => undefined} title="筛选">内容</BottomSheet><Toast message="" /></>)
    const shown = renderToStaticMarkup(<><Dialog open onClose={() => undefined} title="提示">内容</Dialog><BottomSheet open onClose={() => undefined} title="筛选">内容</BottomSheet><Toast message="保存成功" /></>)
    expect(hidden).toBe('')
    expect(shown).toContain('data-ui="Dialog"')
    expect(shown).toContain('data-ui="BottomSheet"')
    expect(shown).toContain('role="status"')
  })

  it('keeps a nested dialog renderable inside a bottom sheet for portal mounting in the browser', () => {
    const html = renderToStaticMarkup(<BottomSheet open onClose={() => undefined} title="筛选"><Dialog open onClose={() => undefined} title="确认">确认内容</Dialog></BottomSheet>)
    expect(html.match(/data-ui="BottomSheet"/g)).toHaveLength(1)
    expect(html.match(/data-ui="Dialog"/g)).toHaveLength(1)
    expect(html).toContain('确认内容')
  })
})
