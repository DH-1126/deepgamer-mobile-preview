import { execFileSync } from 'node:child_process'
import { copyFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assertMatchingHashes, basePath, manifestPath, root, siteDirectory, siteHashes, sourceHashes } from './pages-manifest.mjs'

const before = await sourceHashes()
const run = (args, env = process.env) => execFileSync('pnpm', args, { cwd: root, stdio: 'inherit', env })

// Fail closed: never produce a release manifest when type-checking or any test fails.
execFileSync(process.execPath, ['--test', 'scripts/check-pages-manifest.mjs'], { cwd: root, stdio: 'inherit' })
run(['typecheck'])
run(['test'])
run(['exec', 'vite', 'build', `--base=${basePath}`, '--outDir=release/site', '--emptyOutDir'], {
  ...process.env, VITE_DATA_MODE: 'mock', VITE_STATIC_PREVIEW: 'true',
})
await copyFile(join(siteDirectory, 'index.html'), join(siteDirectory, '404.html'))
await writeFile(join(siteDirectory, '.nojekyll'), '')
const after = await sourceHashes()
assertMatchingHashes(before, after, 'Source files during validation')
await writeFile(manifestPath, `${JSON.stringify({
  schemaVersion: 1,
  preparedAt: new Date().toISOString(),
  basePath,
  dataMode: 'mock',
  staticPreview: true,
  validation: ['pnpm typecheck', 'pnpm test', 'vite build'],
  sourceFiles: after,
  siteFiles: await siteHashes(),
}, null, 2)}\n`)
execFileSync(process.execPath, ['scripts/verify-pages.mjs'], { cwd: root, stdio: 'inherit' })
console.log('User frontend release prepared. Commit the frontend source and release/ together before pushing main.')
