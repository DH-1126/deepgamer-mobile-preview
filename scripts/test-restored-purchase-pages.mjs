import { createRequire } from 'node:module'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MessageChannel } from 'node:worker_threads'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const operations = resolve(root, '../运营平台')
const requireFrontend = createRequire(realpathSync(join(root, 'node_modules/vite/package.json')))
const { build } = await import(requireFrontend.resolve('esbuild'))
const { JSDOM } = createRequire(join(operations, 'apps/admin-web/package.json'))('jsdom')
const outputDirectory = mkdtempSync(join(tmpdir(), 'deepgamer-purchase-pages-'))
const output = join(outputDirectory, 'cases.mjs')

await build({
  absWorkingDir: root,
  entryPoints: ['scripts/test-restored-purchase-pages.cases.tsx'],
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  tsconfig: join(root, 'tsconfig.app.json'),
  loader: { '.css': 'empty' },
  define: { 'import.meta.env.BASE_URL': "'/'" },
  alias: Object.fromEntries(['react', 'react-dom', 'react-router-dom'].map(name => [name, join(root, 'node_modules', name)])),
})

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1:5175/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, HTMLButtonElement: dom.window.HTMLButtonElement, Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent, KeyboardEvent: dom.window.KeyboardEvent, getComputedStyle: dom.window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true })
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
const channels = []
class TestMessageChannel extends MessageChannel {
  constructor() { super(); channels.push(this) }
}
globalThis.MessageChannel = TestMessageChannel
try {
  const suite = await import(pathToFileURL(output).href)
  console.log(JSON.stringify(await suite.runRestoredPurchasePagesCases()))
} finally {
  for (const channel of channels) { channel.port1.close(); channel.port2.close() }
  dom.window.close()
  rmSync(outputDirectory, { recursive: true, force: true })
}
