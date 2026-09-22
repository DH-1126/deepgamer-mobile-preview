import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button, Heading, IconButton, StatusBar, type StatusBarProps } from './ui'
import { X } from 'lucide-react'
import { getPageReviewReference, getPageReviewSpec } from '../data/pageReviewRegistry'
import type { PageElementSpec } from '../data/pageElementSpec'
import '../styles/design-prompt.css'

type ClipboardWriter = Pick<Clipboard, 'writeText'>

export async function copyDesignPrompt(text: string, clipboard: ClipboardWriter | undefined = typeof navigator === 'undefined' ? undefined : navigator.clipboard): Promise<boolean> {
  if (!clipboard?.writeText) return false
  try { await clipboard.writeText(text); return true } catch { return false }
}

const elementFields: Array<{ key: keyof Omit<PageElementSpec, 'name' | 'evidence'>; label: string }> = [
  { key: 'component', label: '使用组件' }, { key: 'visual', label: '视觉逻辑' },
  { key: 'dimensions', label: '尺寸与间距' }, { key: 'typography', label: '字体' },
  { key: 'interaction', label: '交互方式' }, { key: 'ui', label: 'UI 设计' },
  { key: 'dataSource', label: '数据来源' }, { key: 'dataContent', label: '数据内容' },
]

export function PageElementNotes({ elements }: { elements: PageElementSpec[] }) {
  return <div className="page-spec-elements">{elements.map((element, index) => <details className="page-spec-element" key={element.name}>
    <summary><span>{String(index + 1).padStart(2, '0')}</span>{element.name}</summary>
    <dl>{elementFields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{element[field.key]}</dd></div>)}</dl>
    <p className="page-spec-evidence">实现依据 · C（工作区）{element.evidence.map(source => <code key={source}>{source}</code>)}</p>
  </details>)}</div>
}

export function DesignPromptTrigger({ nodeId, className = '', tone, onReviewOpenChange }: { nodeId: string; className?: string; tone?: StatusBarProps['tone']; onReviewOpenChange?: (open: boolean) => void }) {
  const entry = getPageReviewReference(nodeId)
  const spec = getPageReviewSpec(nodeId)
  const [open, setOpen] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'failed'>('idle')
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const currentNode = useRef(nodeId)
  currentNode.current = nodeId
  const id = `page-review-${nodeId.replace(':', '-')}`

  useEffect(() => { setCopyState('idle'); scrollRef.current?.scrollTo({ top: 0 }) }, [nodeId])
  useEffect(() => { onReviewOpenChange?.(open); return () => onReviewOpenChange?.(false) }, [open, onReviewOpenChange])
  useEffect(() => { if (open) panelRef.current?.focus({ preventScroll: true }) }, [open])

  if (!entry || !spec) return null
  const close = () => { setOpen(false); triggerRef.current?.focus({ preventScroll: true }) }
  const panelKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Keep review keyboard interaction independent of the business dialog.
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); close() }
  }
  const copy = async () => {
    if (!entry.prompt) return
    setCopyState('idle')
    const copied = await copyDesignPrompt(entry.prompt)
    if (currentNode.current !== entry.nodeId) return
    setCopyState(copied ? 'success' : 'failed')
    if (!copied) { promptRef.current?.focus(); promptRef.current?.select() }
  }
  const content = open && <div className="page-review-dock" data-node-id={nodeId}>
    <aside ref={panelRef} tabIndex={-1} role="region" id={`${id}-spec`} aria-labelledby={`${id}-title`} className="page-review-panel page-review-panel--spec" onKeyDown={panelKeyDown}>
      <header className="page-review-header"><div><small>PAGE SPEC · 页面说明</small><Heading as="h2" variant="section" id={`${id}-title`}>{entry.screenName} · 页面说明</Heading></div><IconButton label="关闭页面说明" onClick={close}><X size={18} /></IconButton></header>
      <div ref={scrollRef} className="page-review-scroll">
        <section className="page-spec-figma" aria-label="Figma 复刻来源">
          <Heading as="h3" variant="section">Figma 复刻提示词</Heading>
          {entry.prompt && entry.figmaUrl ? <>
            <a href={entry.figmaUrl} target="_blank" rel="noreferrer">{entry.pageName} · {entry.nodeId} · 打开对应设计 ↗</a>
            <textarea ref={promptRef} aria-label="Figma 复刻提示词" readOnly rows={5} value={entry.prompt} onFocus={event => event.currentTarget.select()} />
            <Button fullWidth size="sm" onClick={() => void copy()}>复制提示词和链接</Button>
          </> : <p className="page-review-reference-note" role="status">{entry.referenceNote}</p>}
          {copyState === 'success' && <p className="design-prompt-feedback" role="status">已复制完整提示词和节点链接。</p>}
          {copyState === 'failed' && <p className="design-prompt-feedback design-prompt-feedback--error" role="alert">自动复制失败，提示词已选中，请手动复制。</p>}
        </section>
        <p className="page-spec-summary">{spec.summary}</p>
        <p className="page-review-hint">尺寸与样式依据当前原型实现，单位为 CSS px；正式接口或待配置内容另行标注。说明不读取实际表单输入。</p>
        <Heading as="h3" variant="section" className="page-spec-section-title">页面元素</Heading>
        <p className="page-spec-element-hint">点击元素名称，展开组件、样式、交互与数据说明。</p>
        <PageElementNotes key={nodeId} elements={spec.elements} />
        <section className="page-spec-flow"><Heading as="h3" variant="section">页面流程与异常</Heading>{spec.sections.map(section => <section key={section.title}><h4>{section.title}</h4><ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul></section>)}</section>
      </div>
    </aside>
  </div>
  return <>
    <button ref={triggerRef} type="button" className={`review-status-bar ${className}`} data-ui="PageReviewTrigger" data-review-node-id={nodeId} data-page-spec-trigger data-node-id={nodeId} aria-label="查看页面说明" title="查看页面说明（Figma 与 Spec）" aria-expanded={open} aria-controls={`${id}-spec`} onClick={() => setOpen(true)}>
      <StatusBar tone={tone} />
    </button>
    {typeof document === 'undefined' ? content : createPortal(content, document.body)}
  </>
}
