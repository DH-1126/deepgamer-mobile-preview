import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Heading, IconButton, SectionHeader, StatusBadge } from './index'

describe('heading primitives', () => {
  it.each([
    ['display', 'h1'], ['page', 'h1'], ['section', 'h2'], ['subsection', 'h3'],
  ] as const)('renders the %s visual tier with a semantic %s by default', (variant, tag) => {
    const html = renderToStaticMarkup(<Heading variant={variant}>标题内容</Heading>)
    expect(html).toContain(`<${tag}`)
    expect(html).toContain(`dg-heading--${variant}`)
    expect(html).toContain('data-ui="Heading"')
    expect(html).not.toContain('<button')
  })

  it('decouples visual size from semantic level and forwards heading attributes', () => {
    const html = renderToStaticMarkup(<Heading as="h4" variant="page" align="center" id="example-heading" className="custom-heading" aria-label="标题示例" ref={createRef<HTMLHeadingElement>()}>较长的商品标题完整显示</Heading>)
    expect(html).toContain('<h4')
    expect(html).toContain('dg-heading--page dg-heading--center custom-heading')
    expect(html).toContain('id="example-heading"')
    expect(html).toContain('aria-label="标题示例"')
    expect(html).toContain('较长的商品标题完整显示')
  })

  it('composes a static title with a separate badge and a labelled action', () => {
    const html = renderToStaticMarkup(<SectionHeader title="账号实拍" titleId="shots-title" aria-labelledby="shots-title" badge={<StatusBadge tone="success">已验号</StatusBadge>} action={<IconButton label="刷新实拍" onClick={vi.fn()}>↻</IconButton>} description="所有图片均为验号时留存" />)
    expect(html).toContain('data-ui="SectionHeader"')
    expect(html).toContain('id="shots-title"')
    expect(html).toContain('dg-heading--section')
    expect(html).toContain('dg-section-header__badge')
    expect(html).toContain('dg-section-header__action')
    expect(html).toContain('aria-label="刷新实拍"')
    expect(html.match(/<button\b/g)).toHaveLength(1)
    expect(html).toContain('所有图片均为验号时留存')
  })

  it('omits optional layout slots and preserves explicitly supplied zero values', () => {
    const plain = renderToStaticMarkup(<SectionHeader title="资产概览" variant="subsection" ref={createRef<HTMLElement>()} />)
    expect(plain).toContain('<h3')
    expect(plain).not.toContain('dg-section-header__action')
    expect(plain).not.toContain('dg-section-header__badge')
    expect(plain).not.toContain('dg-section-header__description')
    expect(renderToStaticMarkup(<SectionHeader title="账户信息" badge={0} description={0} />)).toContain('>0</')
  })
})
