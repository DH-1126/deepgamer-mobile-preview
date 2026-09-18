import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { ForgotPasswordPage, LoginPage, SmsHelpPage, validateRecoveryForm } from './AuthPage'

// Load the stylesheet in the Node test runner without adding Node types to the browser app.
const nodeFsModule = 'node:fs'
const { readFileSync } = await import(/* @vite-ignore */ nodeFsModule) as { readFileSync: (path: URL, encoding: 'utf8') => string }
const authStyles = readFileSync(new URL('../styles/auth-v2.css', import.meta.url), 'utf8')

function renderLogin(method: 'one_tap' | 'code' | 'password') {
  return renderToStaticMarkup(<StaticRouter location={method === 'one_tap' ? '/login' : `/login/${method}`}><LoginPage method={method} /></StaticRouter>)
}

describe('LoginPage shared controls', () => {
  it('uses identical agreement copy and links for all three login methods', () => {
    const copies = (['one_tap', 'code', 'password'] as const).map((method) => {
      const html = renderLogin(method)
      expect(html.match(/data-ui="Checkbox"/g)).toHaveLength(1)
      const copy = html.match(/<span class="auth-v2-agreement-copy">([\s\S]*?)<\/label>/)?.[1]
      expect(copy).toBeDefined()
      expect(copy).toContain('已阅读并同意')
      expect(copy).toContain('href="/user-agreement"')
      expect(copy).toContain('《用户服务协议》')
      expect(copy).toContain('href="/privacy-policy"')
      expect(copy).toContain('《隐私政策》')
      expect(copy).not.toContain('自动创建账号')
      return copy
    })
    expect(new Set(copies).size).toBe(1)
  })

  it('shares agreement spacing across methods without legacy button overrides', () => {
    expect(authStyles).not.toMatch(/\.auth-v2-login-(?:manual|one_tap|code|password)\s+\.auth-v2-agreement/)
    expect(authStyles).not.toContain('.auth-v2-agreement > button')
    expect(authStyles).toMatch(/\.auth-v2-agreement \{[^}]*grid-template-columns: 18px minmax\(0, 1fr\)/)
  })

  it('uses 52px shared fields while preserving the phone and code actions', () => {
    const html = renderLogin('code')

    expect(html.match(/data-ui="TextField"/g)).toHaveLength(2)
    expect(html).toContain('+86')
    expect(html).toContain('清空手机号')
    expect(html).toContain('获取验证码')
    expect(html).toContain('data-ui="Button"')
  })

  it('keeps password visibility control in the shared password field', () => {
    const html = renderLogin('password')

    expect(html.match(/data-ui="TextField"/g)).toHaveLength(2)
    expect(html).toContain('显示密码')
    expect(html).toContain('忘记密码？')
  })
})

describe('password recovery pages', () => {
  it('renders the Figma recovery form as an independent route with a carried phone', () => {
    const html = renderToStaticMarkup(<StaticRouter location={{ pathname: '/forgot-password', state: { loginPhone: '18788660033', trigger: 'manual' } }}><ForgotPasswordPage /></StaticRouter>)

    expect(html).toContain('找回登录密码')
    expect(html).toContain('设置新密码')
    expect(html).toContain('187 8866 0033')
    expect(html.match(/data-ui="TextField"/g)).toHaveLength(3)
    expect(html).toContain('8-18 个字符')
    expect(html).toContain('同时包含字母和数字')
    expect(html).toContain('两次输入保持一致')
    expect(html).toContain('检查短信拦截')
    expect(html).toContain('修改成功后，当前账号需重新登录')
    expect(html).not.toContain('密码仅用于')
  })

  it('does not expose an unscoped reset form without a valid phone', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/forgot-password"><ForgotPasswordPage /></StaticRouter>)

    expect(html).toContain('请先确认登录手机号')
    expect(html).toContain('返回填写手机号')
    expect(html).not.toContain('aria-label="新密码"')
  })

  it('validates composition, confirmation, and six-digit verification codes', () => {
    expect(validateRecoveryForm('short', 'different', '12')).toEqual({
      password: '密码需为 8-18 位，并同时包含字母和数字',
      confirmation: '两次输入的密码不一致',
      code: '请输入 6 位验证码',
    })
    expect(validateRecoveryForm('newPass2026', 'newPass2026', '246810')).toEqual({})
  })

  it('renders the standalone SMS troubleshooting content from the design', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/sms-help"><SmsHelpPage /></StaticRouter>)

    expect(html).toContain('无法接收短信的原因')
    expect(html).toContain('手机号是否填错')
    expect(html).toContain('网络信号')
    expect(html).toContain('垃圾短信')
    expect(html).toContain('手机号是否欠费')
  })
})
