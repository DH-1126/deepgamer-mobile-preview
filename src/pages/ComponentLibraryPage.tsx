import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Check, Copy, Headset, Layers3, MessageSquare, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  BottomSheet, Button, Cell, Checkbox, ChoiceChip, CountBadge, Dialog, EmptyStateView,
  FilterTrigger, FullScreenPanel, Heading, IconButton, ImagePreview, InfoList, InlineNotice, MetricGrid, ProductActionBar,
  RangeField, SearchField, StatusBadge, Tabs, TextField, Toast, ToggleSwitch,
  SectionHeader, ActionBar, ActionLink, PageHeader, StatusBar, SurfaceCard, Spinner, TextAreaField, SelectField, OptionTile,
} from '../components/ui'
import { BottomNavView, type NavKey } from '../components/BottomNav'
import { LoginFloatingBar } from '../components/LoginFloatingBar'
import { ProductCard } from '../components/ProductCard'
import { RecyclerCard } from '../components/RecyclerCard'
import { CatalogQuickFilters, type CatalogQuickFilterPanel } from '../components/CatalogQuickFilters'
import { SellerSummary } from '../components/product-detail/SellerSummary'
import { AssetInventory } from '../components/product-detail/AssetInventory'
import { VerificationSeal } from '../components/product-detail/VerificationSeal'
import { ConversationRow } from '../components/ConversationRow'
import { RecycleConversationRow } from '../components/RecycleConversationRow'
import { OrderListCard } from '../components/OrderListCard'
import type { SortKey } from '../types/catalog'
import { products } from '../data/fixtures'
import { recyclerFixtures } from '../data/sellFixtures'
import { catalogProductDetails } from '../data/productDetailFixtures'
import { createRecycleConsultationSeed } from '../data/recycleFixtures'
import { createOrderListSeed } from '../data/orderListFixtures'
import type { Conversation } from '../types/message'
import type { OrderRecord, OrderStatus } from '../types/order'
import {
  componentCategories, componentSourceUrl, componentSpecs, filterComponentSpecs,
  type ComponentCategory, type ComponentSpec,
} from '../data/componentLibrary'
import '../styles/component-library.css'

const tokenSwatches = [
  ['品牌黄', '--dg-color-yellow', '#FFE62A'], ['浅黄选中', '--dg-color-yellow-soft', '#FFF6C4'],
  ['深色选中', '--dg-color-dark-selected', '#17170F'], ['页面背景', '--dg-color-page', '#F7F7F5'],
  ['价格红', '--dg-color-price', '#D9363E'], ['深底价格红', '--dg-color-price-on-dark', '#FF747B'],
  ['卡片背景', '--dg-color-surface', '#FFFFFF'], ['正文', '--dg-color-text', '#1F1F1D'],
] as const

const detailFixture = catalogProductDetails.find(item => item.gameCode === 'wzry') ?? catalogProductDetails[0]
function createMessageStatusDemos(now: number): Array<{ item: Conversation; order: OrderRecord }> {
  return (['pending', 'paid', 'verifying', 'binding', 'bind_success', 'completed', 'closed'] as OrderStatus[]).map((status, index) => {
    const id = `component-library-order-${status}`
    const updatedAt = index === 6 ? new Date(new Date(now).getFullYear() - 1, 11, 18, 15, 26).getTime() : now - index * 86_400_000
    const amount = 1288 + index * 100
    return {
      item: { id: `component-library-conversation-${status}`, kind: 'trade_group', stage: status === 'closed' || status === 'completed' ? 'closed' : 'in_progress', gameCode: index % 2 ? 'ys' : 'wzry', title: '交易群', avatarText: '游', orderId: id, productCode: `${index % 2 ? 'YS' : 'WZ'}-DEMO-${index + 1}`, orderAmount: amount, lastMessage: status === 'pending' ? '请完成支付后继续交易。' : '交易进度仅供组件库演示。', updatedAt, unreadCount: index % 3, closed: status === 'closed' },
      order: { id, role: 'buyer', status, productId: `demo-product-${index}`, productTitle: '组件库演示账号', gameName: index % 2 ? '原神' : '王者荣耀', gameCode: index % 2 ? 'ys' : 'wzry', server: '演示区服', thumbnail: '', goodsAmountCents: amount * 100, serviceAmountCents: 0, insuranceAmountCents: 0, totalAmountCents: amount * 100, conversationId: `component-library-conversation-${status}`, createdAt: updatedAt - 86_400_000, updatedAt },
    }
  })
}

function FoundationPreview() {
  return <div className="cl-foundation">
    <div className="cl-swatches">{tokenSwatches.map(([name, variable, hex]) => <div key={variable}>
      <span style={{ background: `var(${variable})` }} /><b>{name}</b><small>{hex}</small>
    </div>)}</div>
    <div className="cl-type-samples"><b>标题 17 / 强调</b><span>正文 14 / 常规信息</span><small>辅助 12 / 次级说明</small></div>
    <div className="cl-space-samples" aria-label="间距：4、8、12、16、20、24像素">{[1, 2, 3, 4, 5, 6].map((n) => <span key={n}><i style={{ width: `var(--dg-space-${n})` }} />{n * 4}</span>)}</div>
  </div>
}

function Preview({ id, notify }: { id: string; notify: (message: string) => void }) {
  const panelId = useId()
  const [text, setText] = useState('')
  const [submittedText, setSubmittedText] = useState<string | null>(null)
  const [selected, setSelected] = useState('QQ')
  const [enabled, setEnabled] = useState(true)
  const [agreed, setAgreed] = useState(false)
  const [range, setRange] = useState(['500', '1500'])
  const [tab, setTab] = useState('all')
  const [assetTab, setAssetTab] = useState('英雄')
  const [profession, setProfession] = useState('全部')
  const [open, setOpen] = useState(false)
  const [nestedOpen, setNestedOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  const [assetRowCount, setAssetRowCount] = useState<number | null>(null)
  const [navKey, setNavKey] = useState<NavKey>('home')
  const [quickPanel, setQuickPanel] = useState<CatalogQuickFilterPanel | null>(null)
  const [quickValue, setQuickValue] = useState({ sort: 'default' as SortKey, platforms: [] as string[], min: '', max: '' })
  const quickAnchorRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const messageDemoNow = useRef(Date.now()).current
  const messageStatusDemos = createMessageStatusDemos(messageDemoNow)
  const recycleSeed = createRecycleConsultationSeed(messageDemoNow, recyclerFixtures).orders
  const orderListDemos = createOrderListSeed(messageDemoNow).orders
  const recycleMessageDemos = [recycleSeed.find(item => item.stage === 'consulting'), recycleSeed.find(item => item.stage === 'formal')].filter((item): item is NonNullable<typeof item> => Boolean(item))
  useEffect(() => () => clearTimeout(timer.current), [])
  const loadingDemo = () => {
    setLoading(true)
    timer.current = setTimeout(() => { setLoading(false); notify('操作完成（组件演示）') }, 1400)
  }
  const selectionItems = ['全部', 'QQ', '微信', 'Steam']
  const tabItems = [{ value: 'all', label: '全部', count: 12 }, { value: 'pending', label: '待支付', count: 2 }, { value: 'done', label: '已完成', count: 10 }]
  switch (id) {
    case 'Heading': return <div className="cl-heading-examples"><Heading as="h2" variant="display">展示标题 26</Heading><Heading as="h2" variant="hero">主视觉标题 24</Heading><Heading as="h2" variant="result">结果标题 20</Heading><Heading as="h2" variant="dialog">弹窗标题 19</Heading><Heading as="h3" variant="page">页面标题 17</Heading><Heading as="h4">区块标题 16</Heading><Heading as="h5" variant="subsection">辅助标题 14</Heading><Heading as="h3" variant="group">设置分组标题 13</Heading></div>
    case 'StatusBar': return <div className="cl-stack"><StatusBar /><SurfaceCard tone="dark" padding="none"><StatusBar tone="inverse" /></SurfaceCard><p className="cl-caption">设备栏是装饰性示意，不读取真实电量。</p></div>
    case 'PageHeader': return <div className="cl-stack"><PageHeader title="设置" left={<IconButton label="示例返回" onClick={() => notify('返回操作示例')}><ArrowLeft size={20} /></IconButton>} /><PageHeader title="订单详情" sideSize="wide" right={<Button size="xs" variant="ghost" onClick={() => notify('客服操作示例')}>联系客服</Button>}>副标题或状态说明</PageHeader></div>
    case 'SurfaceCard': return <div className="cl-stack"><SurfaceCard padding="none"><Cell label="默认白底卡片" value="16px 圆角" /></SurfaceCard><SurfaceCard tone="muted" padding="sm">浅灰底 · 12px 内边距</SurfaceCard><SurfaceCard tone="brand">品牌浅黄 · 16px 内边距</SurfaceCard><SurfaceCard tone="dark">深色容器 · 保持可读对比</SurfaceCard></div>
    case 'ActionBar': return <div className="cl-stack"><ActionBar layout="primary-end" description="当前示例仅展示主次布局，不提交数据。"><Button variant="outline" onClick={() => notify('取消操作示例')}>取消</Button><Button onClick={() => notify('确认操作示例')}>确认</Button></ActionBar><ActionBar layout="single"><Button disabled fullWidth>不可操作</Button></ActionBar></div>
    case 'ActionLink': return <div className="cl-stack"><ActionLink to="/seller/center" fullWidth onClick={event => { event.preventDefault(); notify('导航按钮演示，不离开组件库') }}>卖家签约</ActionLink><ActionLink to="/" variant="outline" disabled fullWidth>不可跳转</ActionLink></div>
    case 'TextAreaField': return <div className="cl-stack"><TextAreaField label="补充说明示例" placeholder="请输入补充说明" value={text} onChange={event => setText(event.target.value)} maxLength={200} showCount hint="填写内容仅保留在当前示例。" /><TextAreaField label="错误状态" value="" readOnly error="请补充说明后再提交" /><TextAreaField label="禁用状态" defaultValue="不可编辑的说明" disabled /></div>
    case 'SelectField': return <div className="cl-stack"><SelectField label="游戏选择示例" value={selected === 'QQ' ? '' : selected} onChange={event => setSelected(event.target.value)} options={[{ value: '', label: '请选择游戏' }, { value: 'wzry', label: '王者荣耀' }, { value: 'hpjy', label: '和平精英' }]} /><SelectField label="紧凑选择示例" compact disabled defaultValue="all" options={[{ value: 'all', label: '全部状态' }]} /><SelectField label="错误状态" error="请选择一个选项" defaultValue="" options={[{ value: '', label: '请选择' }]} /></div>
    case 'OptionTile': return <div className="cl-stack">{['产品建议', '吐槽服务'].map(title => <OptionTile key={title} title={title} icon={<MessageSquare size={20} />} description="可包含较长说明文字，内容自动换行。" selected={selected === title} onClick={() => setSelected(title)} />)}<OptionTile title="禁用选项" disabled /></div>
    case 'Spinner': return <div className="cl-wrap"><Spinner size="sm" label="小号加载示例" /><Spinner label="加载示例" /><Spinner size="lg" label="大号加载示例" /><span className="cl-caption">正在加载…</span></div>
    case 'BottomNavView': return <div className="cl-stack"><BottomNavView activeKey={navKey} placement="flow" items={[{ key: 'home', label: '首页', href: '/', icon: 'nav-home.svg' }, { key: 'catalog', label: '买号', href: '/game', icon: 'nav-buy.svg' }, { key: 'sell', label: '卖', href: '/sell' }, { key: 'message', label: '消息', href: '/message', icon: 'nav-message.svg', badgeCount: 12 }, { key: 'profile', label: '我的', href: '/profile', icon: 'nav-profile.svg', badgeCount: 3 }]} onNavigate={(event, item) => { event.preventDefault(); setNavKey(item.key) }} /><p className="cl-caption">切换任意页签，消息与订单红点仍然一致；不修改业务未读状态。</p></div>
    case 'LoginFloatingBar': return <LoginFloatingBar placement="flow" onLogin={() => notify('登录引导演示，不更改登录态')} />
    case 'SectionHeader': return <div className="cl-stack"><SectionHeader title="资产概览" badge={<StatusBadge tone="success">已验号</StatusBadge>} action={<Button size="xs" variant="ghost" onClick={() => notify('查看全部资产（演示）')}>查看全部</Button>} description="标题和角标在左，操作在右。" /><SectionHeader title="这是一个用于验证自然换行、同时保留右侧操作的较长资产区块标题" action={<Button size="xs" variant="ghost" onClick={() => notify('长标题操作（演示）')}>操作</Button>} /><SectionHeader as="h4" variant="subsection" title="账号信息" /></div>
    case 'Tokens': return <FoundationPreview />
    case 'Button': return <div className="cl-stack">
      <div className="cl-two"><Button onClick={() => notify('主操作已触发')}>主操作</Button><Button variant="outline" onClick={() => notify('次操作已触发')}>次操作</Button></div>
      <div className="cl-two"><Button variant="secondary" size="md" onClick={() => notify('辅助操作已触发')}>辅助操作</Button><Button variant="ghost" size="md" onClick={() => notify('文字操作已触发')}>文字操作</Button></div>
      <div className="cl-two"><Button shape="pill" loading={loading} onClick={loadingDemo}>{loading ? '正在提交' : '体验加载'}</Button><Button disabled>不可操作</Button></div>
      <Button size="xl" fullWidth onClick={() => notify('登录按钮演示，不改变登录状态')}>登录 · 52px</Button>
      <Button size="xs" variant="outline" onClick={() => notify('紧凑文字操作已触发')}>查看规则 · 24px</Button>
      <Button variant="danger" size="sm" onClick={() => notify('危险操作示例，未删除任何内容')}>危险操作</Button>
    </div>
    case 'IconButton': return <div className="cl-icon-examples">
      <span><IconButton label="复制示例" variant="plain" onClick={() => notify('复制按钮演示')}><Copy size={18} /></IconButton><small>复制</small></span>
      <span><IconButton label="刷新示例" onClick={() => notify('刷新按钮演示')}><RefreshCw size={18} /></IconButton><small>刷新</small></span>
      <span><IconButton label="禁用示例" disabled variant="soft"><Search size={18} /></IconButton><small>禁用</small></span>
    </div>
    case 'TextField': return <div className="cl-stack">
      <TextField label="手机号" leading={<b>+86</b>} type="tel" inputMode="tel" value={text} onChange={e => setText(e.target.value)} placeholder="请输入手机号" />
      <TextField label="错误状态示例" value="500" readOnly error="请输入有效的手机号" />
      <TextField label="禁用状态示例" disabled value="不可编辑" />
    </div>
    case 'SearchField': return <div className="cl-stack"><SearchField aria-label="搜索商品示例" placeholder="搜索商品、游戏或编号" value={text} onChange={e => setText(e.target.value)} onClear={() => setText('')} onSearch={() => setSubmittedText(text.trim())} /><p className="cl-caption" role="status">{submittedText === null ? '输入后点击搜索或按回车，清空后搜索显示全部。' : submittedText ? `已搜索：${submittedText}` : '已搜索：全部商品'}</p></div>
    case 'RangeField': return <RangeField label="价格示例" min={range[0]} max={range[1]} onChange={(min, max) => setRange([min, max])} />
    case 'ChoiceChip': return <div className="cl-stack"><div className="cl-choice-grid">{selectionItems.map(item => <ChoiceChip key={item} selected={selected === item} showCheck onClick={() => setSelected(item)}>{item}</ChoiceChip>)}</div><ChoiceChip disabled>禁用选项</ChoiceChip><ChoiceChip description="42%选择" selected={selected === '530–850'} showCheck onClick={() => setSelected('530–850')}>530–850</ChoiceChip><p className="cl-caption">已选择：{selected}（单选示例）</p></div>
    case 'FilterTrigger': return <div className="cl-stack"><div className="cl-two"><FilterTrigger expanded={open} active={selected === '王者荣耀'} aria-controls={panelId} onClick={() => setOpen(value => !value)}>{selected === '王者荣耀' ? selected : '选择游戏'}</FilterTrigger><FilterTrigger emphasized disabled>浏览时间</FilterTrigger></div>{open && <div id={panelId} className="cl-choice-grid"><ChoiceChip selected={selected === '王者荣耀'} onClick={() => { setSelected('王者荣耀'); setOpen(false) }}>王者荣耀</ChoiceChip><ChoiceChip selected={selected !== '王者荣耀'} onClick={() => { setSelected('全部'); setOpen(false) }}>全部游戏</ChoiceChip></div>}<p className="cl-caption">点击“选择游戏”展开条件，再选择一项收起。</p></div>
    case 'ToggleSwitch': return <div className="cl-stack"><div className="cl-labeled">显示状态文字<ToggleSwitch label="开关示例" checked={enabled} onCheckedChange={setEnabled} showLabel /></div><div className="cl-labeled">仅滑块<ToggleSwitch label="无文字开关示例" checked={agreed} onCheckedChange={setAgreed} /></div><div className="cl-labeled">禁用<ToggleSwitch label="禁用开关示例" checked disabled onCheckedChange={() => undefined} /></div></div>
    case 'Checkbox': return <div className="cl-stack"><Checkbox checked={agreed} onCheckedChange={setAgreed} label="已阅读并同意相关协议" /><Checkbox checked disabled onCheckedChange={() => undefined} label="禁用的已选状态" /><p className="cl-caption">{agreed ? '已勾选' : '尚未勾选'}，仅影响当前示例。</p></div>
    case 'Tabs': return <div className="cl-stack">
      <Tabs label="一级页签示例" panelId={panelId} items={tabItems} value={tab} onValueChange={setTab} variant="underline" size="lg" />
      <Tabs label="状态页签示例" panelId={panelId} items={tabItems} value={tab} onValueChange={setTab} />
      <p id={panelId} role="tabpanel" aria-label="页签示例内容" className="cl-caption">当前视图：{tabItems.find(item => item.value === tab)?.label}</p>
      <Tabs label="二级资产页签示例" items={['英雄', '皮肤'].map(label => ({ value: label, label }))} value={assetTab} onValueChange={setAssetTab} variant="underline" size="md" />
      <p className="cl-caption">选中使用黄色下划线与向上渐隐光晕，文字下移 2px 靠近指示线；一级 17px，二级 14px，胶囊筛选保留黑底。</p>
      <Tabs label="紧凑换行页签示例" size="sm" wrap items={[{ value: '全部', label: '全部' }, { value: '法师', label: '法师', count: '21/24' }, { value: '战士', label: '战士', count: '18/18' }, { value: '射手', label: '射手', count: '14/15' }, { value: '坦克', label: '坦克', count: '12/12' }]} value={profession} onValueChange={setProfession} />
    </div>
    case 'Cell': return <div><Cell icon={<ShieldCheck size={19} />} label="实名认证" value="未实名" onClick={() => notify('列表跳转演示')} /><Cell icon={<MessageSquare size={19} />} label="交易通知" description="重要交易进度及时提醒" trailing={<ToggleSwitch label="列表开关示例" checked={enabled} onCheckedChange={setEnabled} showLabel />} /><Cell label="静态信息" value="无跳转" /></div>
    case 'StatusBadge': return <div className="cl-wrap"><StatusBadge tone="success">售卖中</StatusBadge><StatusBadge tone="warning">交易中</StatusBadge><StatusBadge>已售出</StatusBadge><StatusBadge tone="danger">已下架</StatusBadge><StatusBadge tone="info">信息提示</StatusBadge><StatusBadge tone="brand" icon={<Headset size={12} />}>平台客服</StatusBadge></div>
    case 'CountBadge': return <div className="cl-count-examples">{[0, 3, 99, 128].map(count => <span key={count}><span>{count} 项</span><CountBadge count={count} />{count === 0 && <small>隐藏</small>}</span>)}</div>
    case 'InlineNotice': return <div className="cl-stack"><InlineNotice label="短说明示例">请在平台内完成交易。</InlineNotice><InlineNotice label="多行风险提醒示例" tone="warning"><p><strong>提醒：</strong>私下交易有风险，钱号两空无保障，未成年人禁止售卖账号</p></InlineNotice><p className="cl-caption">回收页底部风险说明使用无色块页脚文本，不套用本提示条。</p></div>
    case 'EmptyStateView': return <EmptyStateView compact icon={<Search size={28} />} title="暂无相关商品" description="试试调整筛选条件" action={<Button size="sm" variant="outline" onClick={() => notify('重置筛选示例')}>重置筛选</Button>} />
    case 'Dialog': return <><Button fullWidth variant="outline" onClick={() => setOpen(true)}>打开确认弹窗</Button><Dialog open={open} onClose={() => setOpen(false)} title="确认操作" actions={<><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={() => { setOpen(false); notify('已确认，仅为组件演示') }}>确定</Button></>}>这是通用确认弹窗。示例操作不会删除收藏、修改订单或账户信息。</Dialog></>
    case 'BottomSheet': return <><Button fullWidth variant="outline" onClick={() => setOpen(true)}>打开底部弹层</Button><BottomSheet open={open} onClose={() => { setOpen(false); setNestedOpen(false) }} title="选择通知方式" subtitle="仅在当前组件示例中生效" actions={<Button fullWidth shape="pill" onClick={() => { setOpen(false); notify('示例选择已确认') }}>确定</Button>}><div className="cl-stack">{['站内通知', '微信通知'].map(item => <ChoiceChip key={item} selected={selected === item} showCheck onClick={() => setSelected(item)}>{item}</ChoiceChip>)}<Button size="sm" variant="ghost" onClick={() => setNestedOpen(true)}>查看弹窗说明</Button></div><Dialog open={nestedOpen} onClose={() => setNestedOpen(false)} title="弹层嵌套示例" actions={<Button fullWidth onClick={() => setNestedOpen(false)}>知道了</Button>}><div className="cl-stack"><p>仅最上层弹窗可以交互，关闭后回到下方弹层。</p><TextField label="示例备注" placeholder="输入内容，焦点不会丢失" value={text} onChange={event => setText(event.target.value)} /></div></Dialog></BottomSheet></>
    case 'FullScreenPanel': return <><Button fullWidth variant="outline" onClick={() => setOpen(true)}>打开全屏面板</Button><FullScreenPanel open={open} onClose={() => setOpen(false)} title="购买确认" footer={<Button fullWidth onClick={() => { setOpen(false); notify('全屏面板操作已确认') }}>确认购买</Button>}><div className="cl-stack"><p className="cl-caption">正文区域可独立滚动；底部操作由调用者传入，面板本身不改变路由。</p><TextField label="备注" value={text} onChange={event => setText(event.target.value)} placeholder="可选填写" /></div></FullScreenPanel></>
    case 'ImagePreview': return <><Button fullWidth variant="outline" onClick={() => setOpen(true)}>打开图片预览</Button><ImagePreview open={open} onClose={() => setOpen(false)} items={[{ src: products[0].image, alt: '账号商品预览图', source: '商品主图' }, { src: products[1].image, alt: '账号商品补充图', source: '补充凭证' }]} index={imageIndex} onIndexChange={setImageIndex} onShare={() => notify('分享图片演示')} /></>
    case 'Toast': return <Button variant="outline" fullWidth icon={<Check size={18} />} onClick={() => notify('操作成功，1.8 秒后自动关闭')}>体验轻提示</Button>
    case 'MetricGrid': return <div className="cl-stack"><MetricGrid label="普通指标示例" columns={2} items={[{ label: '英雄数量', value: 132 }, { label: '皮肤数量', value: 0 }]} /><MetricGrid variant="emphasis" columns={3} valueSize="compact" label="六项黑色属性值示例" items={[{ label: '荣耀典藏', value: 9 }, { label: '传说皮肤', value: 63 }, { label: '史诗皮肤', value: 181 }, { label: '无双皮肤', value: 2 }, { label: '典藏皮肤', value: 3 }, { label: '珍品传说', value: 2 }]} /><MetricGrid variant="summary" items={[{ label: '售价', value: '¥4,370' }, { label: '发布时间', value: '今天' }, { label: '状态', value: '售卖中' }]} /></div>
    case 'InfoList': return <InfoList onHint={(id, hint) => notify(`${id}：${hint}`)} items={[{ id: 'serial', label: '商品编号', value: <span className="cl-code-value">WZAHC7169 <IconButton size="sm" variant="plain" label="复制商品编号" onClick={() => notify('商品编号已复制（演示）')}><Copy size={15} /></IconButton></span> }, { id: 'real-name', label: '实名状态', value: '已实名，可二次实名', tone: 'success', hint: '实名认证说明' }, { id: 'platform', label: '登录平台', value: 'iOS QQ' }]} />
    case 'ProductActionBar': return <ProductActionBar favorite={enabled} onFavorite={() => setEnabled(value => !value)} onConsult={() => notify('咨询入口演示')} onPurchase={() => notify('购买入口演示')} purchaseLabel="立即购买" />
    case 'ProductCard': return <div className="cl-product-preview catalog-d3"><ProductCard product={products[0]} variant="catalogV2" /></div>
    case 'RecyclerCard': return <div className="cl-stack">{[recyclerFixtures[0], recyclerFixtures[3]].map(recycler => <RecyclerCard key={recycler.id} recycler={recycler} onConsult={item => notify(`咨询${item.name}（组件演示，不创建会话）`)} />)}</div>
    case 'OrderListCard': return <div className="cl-stack" onClickCapture={event => { const action = (event.target as Element).closest('a'); if (action) { event.preventDefault(); notify(`${action.textContent ?? '订单操作'}（组件演示，不离开组件库）`) } }}><p className="cl-caption">十种独立订单状态：黄色进行中、绿色完成、灰色关闭；仅待付款展示倒计时。</p>{orderListDemos.map(order => <OrderListCard key={order.id} order={order} now={messageDemoNow} onShowPayout={payoutOrder => notify(`查看 ${payoutOrder.id} 的打款明细（组件演示）`)} />)}</div>
    case 'SellerSummary': return <div className="cl-stack"><SellerSummary text="主玩打野，晚上在线，资料可以随时补充。" onOpen={() => notify('查看卖家说明（演示）')} /><SellerSummary maxLines={2} text="这是一段较长的卖家说明，用于展示最多两行内容；点击只会触发本页提示。" onOpen={() => notify('查看卖家说明（演示）')} /></div>
    case 'AssetInventory': return detailFixture ? <div className="cl-stack"><AssetInventory detail={detailFixture} onRowCountChange={setAssetRowCount} /><p className="cl-caption">{assetRowCount == null ? '正在计算资产行数…' : `当前展示 ${assetRowCount} 行资产（仅本页状态）`}</p></div> : null
    case 'VerificationSeal': return <div className="cl-wrap"><VerificationSeal /><VerificationSeal watermark /><p className="cl-caption">普通与水印模式；状态由业务核验结果决定，印章不拦截点击。</p></div>
    case 'ConversationRow': return <div className="cl-message-preview"><ConversationRow item={{ id: 'component-library-support', kind: 'support', stage: 'in_progress', title: '萌萌 · 平台客服', avatarText: '萌', lastMessage: '您好，需要我帮您推荐合适的账号吗？', updatedAt: messageDemoNow, unreadCount: 2 }} onOpen={() => notify('打开平台客服（演示）')} />{messageStatusDemos.map(({ item, order }) => <ConversationRow key={item.id} item={item} order={order} showTypeBadge onOpen={() => notify('打开交易群（演示，不标记已读）')} />)}</div>
    case 'RecycleConversationRow': return <div className="cl-message-preview">{recycleMessageDemos.map(item => <RecycleConversationRow key={item.id} item={item} showTypeBadge onOpen={() => notify('打开回收咨询（演示）')} />)}</div>
    case 'CatalogQuickFilters': return <div className="cl-stack"><div className="cl-wrap" ref={quickAnchorRef}>{([['sort', '排序'], ['server', '游戏区服'], ['price', '价格']] as const).map(([panel, label]) => <FilterTrigger key={panel} expanded={quickPanel === panel} aria-controls={`${panel}-quick-filter`} aria-haspopup="dialog" onClick={() => setQuickPanel(current => current === panel ? null : panel)}>{label}</FilterTrigger>)}</div><p className="cl-caption">选择或重置只修改草稿，点击确定后生效；点击遮罩或按 Escape 取消。</p>{quickPanel && <CatalogQuickFilters key={quickPanel} panel={quickPanel} anchorRef={quickAnchorRef} sort={quickValue.sort} platforms={quickValue.platforms} minPrice={quickValue.min} maxPrice={quickValue.max} onClose={() => setQuickPanel(null)} onApplySort={sort => { setQuickValue(value => ({ ...value, sort })); setQuickPanel(null); notify('排序已应用（组件演示）') }} onApplyServer={platforms => { setQuickValue(value => ({ ...value, platforms })); setQuickPanel(null); notify('区服已应用（组件演示）') }} onApplyPrice={(min, max) => { setQuickValue(value => ({ ...value, min, max })); setQuickPanel(null); notify('价格已应用（组件演示）') }} />}</div>
    default: return null
  }
}

function SpecCard({ spec, children }: { spec: ComponentSpec; children: ReactNode }) {
  return <SurfaceCard className="cl-card" aria-labelledby={`component-${spec.id}`} data-component-spec={spec.id}>
    <header><div><Heading as="h2" id={`component-${spec.id}`}>{spec.name}</Heading><code>{spec.id}</code></div><span>{componentCategories.find(category => category.value === spec.category)?.label}</span></header>
    <p>{spec.description}</p><div className="cl-preview">{children}</div>
    <details className="cl-spec"><summary>规范与引用方式</summary><div>
      <ul>{spec.rules.map(rule => <li key={rule}>{rule}</li>)}</ul>
      <p><b>适用场景：</b>{spec.usage}</p>
      <pre><code>{spec.id === 'Tokens' ? '' : `import { ${spec.id} } from '${spec.importFrom ?? (['ProductCard', 'RecyclerCard', 'CatalogQuickFilters'].includes(spec.id) ? `../components/${spec.id}` : '../components/ui')}'\n\n`}{spec.example}</code></pre>
      {spec.source ? <a href={componentSourceUrl(spec.source)} target="_blank" rel="noreferrer">查看 Figma 设计来源 ↗</a> : <p className="cl-source-note">近期前端实现对齐：未新增或虚构 Figma 来源节点。</p>}
    </div></details>
  </SurfaceCard>
}

export function ComponentLibraryPage() {
  const [category, setCategory] = useState<ComponentCategory>('all')
  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [message, setMessage] = useState('')
  const visible = filterComponentSpecs(category, query)
  return <main className="cl-page">
    <PageHeader className="cl-header" title="组件库" left={<Link to="/profile" aria-label="返回我的" className="cl-back"><ArrowLeft size={20} /></Link>} right={<span className="cl-header-mark">UI KIT</span>} />
    <div className="cl-intro"><span className="cl-brand"><Layers3 size={23} /></span><div><Heading as="h2">深度玩家 · 设计组件</Heading><p>一份组件，多处复用</p><small className="cl-update-note">全域对齐：标题、页头、表单、操作栏、导航与业务状态</small></div><strong>{componentSpecs.length}<small>项规范</small></strong></div>
    <div className="cl-finder"><SearchField aria-label="搜索组件与规范" placeholder="搜索组件、场景或规范" value={draftQuery} onChange={e => setDraftQuery(e.target.value)} onClear={() => setDraftQuery('')} onSearch={() => setQuery(draftQuery.trim())} /><Tabs label="组件分类" panelId="component-library-results" items={[...componentCategories]} value={category} onValueChange={value => setCategory(value as ComponentCategory)} /></div>
    <div className="cl-results-heading"><span>{query ? `“${query}”的搜索结果` : componentCategories.find(item => item.value === category)?.label}</span><small>共 {visible.length} 项 · 示例可操作</small></div>
    <div className="cl-cards" id="component-library-results" role="tabpanel" aria-label="组件分类结果">{visible.map(spec => <SpecCard key={spec.id} spec={spec}><Preview id={spec.id} notify={setMessage} /></SpecCard>)}
      {!visible.length && <EmptyStateView icon={<Search size={28} />} title="没有找到对应组件" description="试试搜索“筛选”“登录”或英文组件名" action={<Button variant="outline" onClick={() => { setCategory('all'); setQuery(''); setDraftQuery('') }}>查看全部组件</Button>} />}
    </div>
    <footer className="cl-footer">示例只影响本页，不修改任何业务数据。<br />基础组件从 components/ui 引用；业务组件请按卡片列出的真实模块路径引用。</footer>
    <Toast message={message} onDismiss={() => setMessage('')} />
  </main>
}
