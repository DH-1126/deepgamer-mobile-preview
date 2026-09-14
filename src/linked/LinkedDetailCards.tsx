import type { CSSProperties, ReactNode } from 'react'
import type { LinkedDetailFieldView, LinkedDetailView, LinkedPublishSnapshot } from '../../../双端演示/src/contract'
import '../styles/linked-detail.css'

const fontSizes: Record<LinkedDetailFieldView['style']['fontSize'], string> = {
  SMALL: '12px', MEDIUM: '14px', LARGE: '18px',
}

function valueStyle(field: LinkedDetailFieldView): CSSProperties {
  return { color: field.style.color, fontSize: fontSizes[field.style.fontSize], fontWeight: field.style.bold ? 700 : 400 }
}

function FieldValue({ field }: { field: LinkedDetailFieldView }) {
  const content = <><span>{field.displayValue}</span>{field.provided && field.unit && <small>{field.unit}</small>}</>
  if (field.uiType === 'TAG') return <span className="linked-detail-value is-ui-tag" style={valueStyle(field)}>{content}</span>
  if (field.uiType === 'STAT') return <strong className="linked-detail-value is-ui-stat" style={valueStyle(field)}>{content}</strong>
  if (field.uiType === 'TABLE_ROW') return <span className="linked-detail-value is-ui-table-row" style={valueStyle(field)}>{content}</span>
  if (field.uiType === 'TEXT') return <span className="linked-detail-value is-ui-text" style={valueStyle(field)}>{content}</span>
  return <span className="linked-detail-value is-ui-unsupported" role="status">显示方式不可用</span>
}

function InfoGrid({ fields }: { fields: LinkedDetailFieldView[] }) {
  return <dl className="linked-detail-info-grid">{fields.map((field) => <div className={field.highlighted ? 'is-highlighted' : ''} key={field.fieldKey}><dt>{field.label}</dt><dd><FieldValue field={field} /></dd></div>)}</dl>
}

function HighlightTags({ fields }: { fields: LinkedDetailFieldView[] }) {
  return <ul className="linked-detail-highlight-tags">{fields.map((field) => <li className={field.highlighted ? 'is-highlighted' : ''} key={field.fieldKey}><span>{field.label}</span><FieldValue field={field} /></li>)}</ul>
}

function DescriptionTable({ fields }: { fields: LinkedDetailFieldView[] }) {
  return <table className="linked-detail-description-table"><tbody>{fields.map((field) => <tr className={field.highlighted ? 'is-highlighted' : ''} key={field.fieldKey}><th scope="row">{field.label}</th><td><FieldValue field={field} /></td></tr>)}</tbody></table>
}

function AssetStats({ fields }: { fields: LinkedDetailFieldView[] }) {
  return <dl className="linked-detail-asset-stats">{fields.map((field) => <div className={field.highlighted ? 'is-highlighted' : ''} key={field.fieldKey}><dt>{field.label}</dt><dd><FieldValue field={field} /></dd></div>)}</dl>
}

function sectionContent(displayType: string, fields: LinkedDetailFieldView[]): ReactNode {
  if (!fields.length) return <p className="linked-detail-empty-section">当前区块暂无可展示字段</p>
  if (displayType === 'INFO_GRID') return <InfoGrid fields={fields} />
  if (displayType === 'HIGHLIGHT_TAGS') return <HighlightTags fields={fields} />
  if (displayType === 'DESCRIPTION_TABLE') return <DescriptionTable fields={fields} />
  if (displayType === 'ASSET_STATS') return <AssetStats fields={fields} />
  return <p className="linked-detail-empty-section" role="status">当前区块布局不可用，未展示配置字段</p>
}

function modeMessage(view: LinkedDetailView) {
  if (view.mode === 'MISSING') return '当前游戏暂无已发布详情配置，保留商品基本资料。'
  if (view.mode === 'BLOCKED') return '当前详情配置不可用，未展示动态字段，保留商品基本资料。'
  if (view.mode === 'DISABLED') return '当前详情配置已停用，动态卡片已隐藏，保留商品基本资料。'
  if (view.dataMode === 'UNAVAILABLE') return '当前详情配置已发布，但该商品尚无与配置基线一致的可核验提交资料。'
  return ''
}

export function LinkedCurrentDetailCard({ view }: { view: LinkedDetailView | null }) {
  if (!view) return <aside className="linked-detail-state" role="status">正在同步当前详情配置…</aside>
  const message = modeMessage(view)
  if (message) return <aside className={`linked-detail-state is-${view.mode.toLowerCase()}`} role="status"><strong>当前详情卡片</strong><p>{message}</p>{view.issues.length > 0 && <ul>{view.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}</aside>
  return <section className="linked-current-detail-card" data-display-version={view.versionId ?? ''} data-fact-version={view.factVersionId ?? ''}>
    <header><div><h3>当前详情卡片</h3><span>动态配置</span></div><small>{view.versionNo == null ? '已发布配置' : `配置 V${view.versionNo}`} · 基于提交时快照</small></header>
    {view.issues.length > 0 && <aside className="linked-detail-fact-notice" role="status"><ul>{view.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></aside>}
    {view.sections.map((section) => <section className={`linked-detail-section is-${section.displayType.toLowerCase().replaceAll('_', '-')}`} key={section.sectionKey}><header><h4>{section.title}</h4>{section.description && <p>{section.description}</p>}</header>{sectionContent(section.displayType, section.fields)}</section>)}
  </section>
}

export function LinkedSubmissionSnapshot({ snapshot }: { snapshot: LinkedPublishSnapshot | undefined }) {
  if (!snapshot) return <aside className="linked-detail-state is-unavailable" role="status"><strong>提交时资料</strong><p>该商品尚无可核验的提交快照。</p></aside>
  const providedCount = snapshot.sections.flatMap((section) => section.fields).filter((field) => field.provided).length
  return <details className="linked-submission-snapshot"><summary><span>提交时资料</span><small>原始快照 · 已提供 {providedCount} 项</small></summary><div>{snapshot.sections.map((section) => <section key={section.sectionKey}><h4>{section.title}</h4><dl className="detail-info-list">{section.fields.map((field) => <div key={field.fieldKey}><dt>{field.label}</dt><dd>{field.displayValue}</dd></div>)}</dl></section>)}</div></details>
}
