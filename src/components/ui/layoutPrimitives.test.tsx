import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { ActionBar, ActionLink, Button, IconButton, PageHeader, Spinner, StatusBar, SurfaceCard } from './index'

describe('shared page structure', () => {
  it('renders balanced heading slots with separate controls and subtitle', () => {
    const html = renderToStaticMarkup(<PageHeader title="设置" left={<IconButton label="返回">←</IconButton>} right={<Button variant="ghost" size="xs">保存</Button>}>可选说明</PageHeader>)
    expect(html).toContain('data-ui="PageHeader"')
    expect(html).toContain('dg-page-header__side--left')
    expect(html).toContain('dg-page-header__side--right')
    expect(html).toContain('dg-heading--page dg-heading--center')
    expect(html).toContain('可选说明')
    expect(html.match(/<button/g)).toHaveLength(2)
  })
  it('can represent dark and transparent headers without fixed positioning', () => {
    const html = renderToStaticMarkup(<PageHeader title="钱包" tone="dark" sideSize="wide" bordered={false} titleAs="h2" />)
    expect(html).toContain('dg-page-header--dark dg-page-header--wide')
    expect(html).not.toContain('dg-page-header--bordered')
    expect(html).toContain('<h2')
  })
  it('uses existing device assets and hides decorative status information', () => {
    const html = renderToStaticMarkup(<StatusBar tone="inverse" />)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('dg-status-bar--inverse')
    expect(html.match(/<img/g)).toHaveLength(3)
    expect(html).toContain('status-battery.svg')
  })
  it('keeps cards static and provides semantic containers', () => {
    const html = renderToStaticMarkup(<SurfaceCard as="article" tone="dark" padding="none" aria-label="预览卡片">内容</SurfaceCard>)
    expect(html).toContain('<article')
    expect(html).toContain('dg-surface-card--dark dg-surface-card--none')
    expect(html).not.toContain('<button')
  })
  it('composes action bars without duplicating their child controls', () => {
    const html = renderToStaticMarkup(<ActionBar layout="primary-end" description="核对后提交"><Button variant="outline">取消</Button><Button>确认</Button></ActionBar>)
    expect(html).toContain('dg-action-bar__actions--primary-end')
    expect(html).not.toContain('dg-action-bar--sticky')
    expect(html.match(/<button/g)).toHaveLength(2)
  })
  it('renders accessible and decorative loading variants', () => {
    expect(renderToStaticMarkup(<Spinner label="正在读取" />)).toContain('role="status" aria-label="正在读取"')
    const html = renderToStaticMarkup(<Spinner decorative size="sm" />)
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('role="status"')
  })
  it('retains link semantics and removes the destination when disabled', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/"><ActionLink to="/profile" variant="outline">查看</ActionLink><ActionLink to="/wallet" disabled>未开放</ActionLink></StaticRouter>)
    expect(html).toContain('href="/profile"')
    expect(html).toContain('dg-button--outline')
    expect(html).not.toContain('href="/wallet"')
    expect(html).toContain('aria-disabled="true"')
  })
})
