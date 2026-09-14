import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assertMatchingHashes, basePath, manifestPath, siteDirectory, siteHashes, sourceHashes } from './pages-manifest.mjs'

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (manifest.schemaVersion !== 1 || manifest.basePath !== basePath || manifest.dataMode !== 'mock' || manifest.staticPreview !== true) {
  throw new Error('Unexpected release target or data mode')
}
if (JSON.stringify(manifest.validation) !== JSON.stringify(['pnpm typecheck', 'pnpm test', 'vite build'])) {
  throw new Error('Release must complete the full validation pipeline')
}
assertMatchingHashes(manifest.sourceFiles, await sourceHashes(), 'Frontend source')
const files = await siteHashes()
assertMatchingHashes(manifest.siteFiles, files, 'Built frontend')
if (!files['index.html'] || !files['404.html'] || !files['.nojekyll'] || files['index.html'] !== files['404.html']) {
  throw new Error('Missing or inconsistent SPA fallback')
}
const html = await readFile(join(siteDirectory, 'index.html'), 'utf8')
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const path = match[1]
  if (!path.startsWith(basePath) || !files[path.slice(basePath.length)]) throw new Error(`Missing or incorrect entry asset: ${path}`)
}
console.log(`Verified ${Object.keys(manifest.sourceFiles).length} source files and ${Object.keys(files).length} frontend assets.`)
