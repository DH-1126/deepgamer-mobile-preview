import { afterEach, describe, expect, it, vi } from 'vitest'

function installTopLevelWindow() {
  const browser = new EventTarget() as EventTarget & { parent: unknown }
  browser.parent = browser
  vi.stubGlobal('window', browser)
}

function installEmbeddedWindow() {
  const browser = new EventTarget() as EventTarget & { parent: unknown }
  browser.parent = { postMessage: vi.fn() }
  vi.stubGlobal('window', browser)
}

async function renderLinkedStateProbe(mode: string) {
  vi.resetModules()
  vi.stubEnv('VITE_DATA_MODE', mode)
  installTopLevelWindow()
  const fetcher = vi.fn(() => new Promise<Response>(() => undefined))
  vi.stubGlobal('fetch', fetcher)

  const [{ createElement }, { renderToStaticMarkup }, { useLinkedState }] = await Promise.all([
    import('react'),
    import('react-dom/server'),
    import('./linkedData'),
  ])
  function Probe() {
    useLinkedState()
    return createElement('span', null, 'probe')
  }
  renderToStaticMarkup(createElement(Probe))
  await Promise.resolve()
  return fetcher
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('legacy linked HTTP startup isolation', () => {
  it.each(['prototype', 'restored-linked'])('does not start administrator HTTP in %s mode', async (mode) => {
    const fetcher = await renderLinkedStateProbe(mode)

    expect(fetcher).not.toHaveBeenCalled()
  })

  it('preserves top-level HTTP startup in the legacy linked mode', async () => {
    const fetcher = await renderLinkedStateProbe('linked')

    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/game-management/games?page=1&pageSize=1',
      expect.objectContaining({ credentials: 'same-origin' }),
    )
  })

  it('preserves the embedded channel for the existing iframe integration', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_DATA_MODE', 'prototype')
    installEmbeddedWindow()
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)

    const linked = await import('./linkedData')

    expect(linked.linkedChannel).toBe('embedded')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('blocks direct legacy administrator API access from restored-linked mode', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_DATA_MODE', 'restored-linked')
    installTopLevelWindow()
    const fetcher = vi.fn(async () => new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetcher)
    const client = await import('./httpLinkedClient')

    await expect(client.fetchLinkedOrderRows()).rejects.toMatchObject({ code: 'LINKED_MODE_INACTIVE' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
