import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import componentLibraryCss from '../styles/component-library.css?raw'
import { describe, expect, it } from 'vitest'
import { ComponentLibraryPage } from './ComponentLibraryPage'
import { componentCategories, componentSpecs } from '../data/componentLibrary'

describe('component library page', () => {
  it('renders classified, searchable specs and real shared component examples', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/component-library"><ComponentLibraryPage /></StaticRouter>)
    expect(html).toContain('aria-label="返回我的"')
    expect(html).toContain('href="/profile"')
    expect(html).toContain('aria-label="搜索组件与规范"')
    expect(html.match(/>搜索<\/button>/g)).toHaveLength(2)
    expect(html).toContain('输入后点击搜索或按回车，清空后搜索显示全部。')
    expect(html).toContain('aria-label="组件分类"')
    for (const category of componentCategories) expect(html).toContain(category.label)
    for (const spec of componentSpecs) expect(html).toContain(`data-component-spec="${spec.id}"`)
    for (const id of ['Heading', 'SectionHeader', 'Button', 'IconButton', 'TextField', 'SearchField', 'RangeField', 'ChoiceChip', 'Tabs', 'Checkbox', 'ToggleSwitch', 'StatusBadge', 'CountBadge', 'Cell', 'EmptyStateView', 'MetricGrid', 'InfoList', 'ProductActionBar', 'SellerSummary']) expect(html).toContain(`data-ui="${id}"`)
    expect(html.match(/<details/g)).toHaveLength(componentSpecs.length)
    expect(html).not.toContain('role="dialog"')
    expect(html).toContain('示例只影响本页，不修改任何业务数据。')
    expect(html.match(/data-ui="RecyclerCard"/g)).toHaveLength(2)
    expect(html).toContain('../components/RecyclerCard')
    expect(html).toContain('aria-label="免费咨询真趣十足"')
    expect(html).toContain('aria-label="暂不可咨询夜猫回收"')
    expect(html.match(/data-ui="InlineNotice"/g)).toHaveLength(2)
    expect(html).toContain('aria-label="多行风险提醒示例"')
    expect(html).toContain('六项黑色属性值示例')
    expect(html).toContain('aria-label="复制商品编号"')
    expect(html).not.toContain('复制编号 · 24px')
    expect(html).not.toContain('dg-icon-button--soft" aria-label="复制示例"')
    expect(html).toContain('../components/product-detail/SellerSummary')
    expect(html).toContain('../components/ConversationRow')
    expect(html).toContain('../components/RecycleConversationRow')
    expect(html).toContain('trade-state-pending')
    expect(html).toContain('trade-state-materials')
    expect(html).toContain('trade-state-inspection')
    expect(html).toContain('trade-state-binding')
    expect(html).toContain('trade-state-release')
    expect(html).toContain('trade-state-completed')
    expect(html).toContain('trade-state-closed')
    expect(html).toContain('>沟通中</em>')
    expect(html).toContain('>已下单</em>')
    expect(html).toContain('近期前端实现对齐：未新增或虚构 Figma 来源节点。')
    expect(html).toContain('这是一个用于验证自然换行、同时保留右侧操作的较长资产区块标题')
    expect(html).toContain('dg-heading--section')
    for (const id of ['StatusBar', 'PageHeader', 'SurfaceCard', 'ActionBar', 'ActionLink', 'TextAreaField', 'SelectField', 'OptionTile', 'Spinner', 'BottomNav']) expect(html).toContain(`data-ui="${id}"`)
    expect(html).toContain('home-draft3-login-bar--flow')
    for (const variant of ['hero', 'result', 'dialog', 'group']) expect(html).toContain(`dg-heading--${variant}`)
  })

  it('leaves component-library headings to the shared Heading contract', () => {
    for (const selector of ['.cl-header h1', '.cl-intro h2', '.cl-card > header h2']) expect(componentLibraryCss).not.toContain(selector)
  })
})
