import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { AboutUsPage, AccountSecurityPage, AccountSettingsPage, PasswordSettingsPage, PrivacyAgreementCenterPage } from './ProfileSettingsPages'

describe('profile secondary pages', () => {
  it('shows the supplied About Us information with the current platform logo', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/about-us"><AboutUsPage /></StaticRouter>)
    for (const text of ['平台介绍', 'assets/auth-draft3/brand-mark.svg', '专注游戏账号估价、交易保障与售后服务', '当前版本', 'v1.0.0', '子瓜手虫（上海）电子商务有限公司', '沪ICP备2024065370号-3A']) expect(html).toContain(text)
    expect(html.match(/<dt>/g)).toHaveLength(3)
    expect(html).not.toContain('版本 1.2.0')
    expect(html).not.toContain('>DG</span>')
  })
  it('removes account options and cancellation from settings while retaining logout and notification settings', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/settings"><AccountSettingsPage /></StaticRouter>)
    expect(html).not.toContain('实名认证')
    expect(html).not.toContain('href="/realname')
    for (const text of ['头像与昵称', '手机号', '登录密码', '注销账号', 'aria-label="账号设置"', 'href="/settings/password"', 'href="/settings/cancellation"']) expect(html).not.toContain(text)
    for (const text of ['通知设置', '短信通知', '免打扰', '退出登录']) expect(html).toContain(text)
  })

  it('moves the existing account cells and cancellation link into Account Security without changing their interaction styles', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/account-security"><AccountSecurityPage /></StaticRouter>)
    expect(html).toContain('data-ui="Heading"')
    expect(html).toContain('账号与安全</h1>')
    expect(html).toContain('头像与昵称')
    expect(html).toContain('href="/account-security/profile"')
    expect(html).toContain('href="/account-security/phone"')
    expect(html).toContain('手机号')
    expect(html).toContain('登录密码')
    expect(html).toContain('href="/settings/password"')
    expect(html).toContain('class="profile-settings-v2-cancel-link" href="/settings/cancellation"')
    expect(html.match(/data-ui="Cell"/g)).toHaveLength(3)
    expect(html).not.toContain('通知设置')
    expect(html).not.toContain('退出登录')
  })

  it('uses the profile menu layout without icons for privacy and agreement links', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/privacy-and-agreements"><PrivacyAgreementCenterPage /></StaticRouter>)
    const list = html.match(/<section aria-label="隐私与协议列表"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect(list).toContain('data-ui="ProfileFeatureList"')
    expect(list.match(/data-ui="Cell"/g)).toHaveLength(3)
    expect(list).not.toContain('dg-cell__icon')
    expect(list.match(/dg-cell__arrow/g)).toHaveLength(3)
    expect(list).toContain('href="/privacy-policy"')
    expect(list).toContain('href="/user-agreement"')
    expect(list).toContain('href="/about-us"')
  })

  it('shows only cache and about entries in General settings', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/settings"><AccountSettingsPage /></StaticRouter>)
    const general = html.match(/<section[^>]*aria-label="通用设置"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect(html).toContain('dg-heading--group')
    expect(html).toContain('>通用</h2>')
    expect(html).not.toContain('隐私与通用')
    expect(html).not.toContain('隐私与协议')
    expect(html).not.toContain('系统权限')
    expect(general.match(/data-ui="Cell"/g)).toHaveLength(2)
    expect(general).toContain('清除缓存')
    expect(general).toContain('关于深度玩家')
    expect(general).toContain('href="/about-us"')
  })

  it.each(['setup', 'change'] as const)('renders the %s password mode with a reversible heading control', mode => {
    const html = renderToStaticMarkup(<StaticRouter location={`/settings/password?mode=${mode}`}><PasswordSettingsPage /></StaticRouter>)
    expect(html).toContain(`data-password-mode="${mode}"`)
    expect(html).toContain('profile-settings-v2-mode-switch')
    expect(html).toContain(mode === 'setup' ? '设置新密码，点击切换为修改密码' : '修改密码，点击切换为设置新密码')
    expect(html.includes('autoComplete="current-password"')).toBe(mode === 'change')
    expect(html).toContain('确认新密码')
    expect(html).toContain('获取验证码')
  })
})
