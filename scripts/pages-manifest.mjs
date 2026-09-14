import { createHash } from 'node:crypto'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const siteDirectory = join(root, 'release/site')
export const manifestPath = join(root, 'release/manifest.json')
export const basePath = '/deepgamer-mobile-preview/'

async function hashFileTree(path, base, result) {
  const info = await lstat(path)
  if (info.isSymbolicLink()) throw new Error(`Release inputs must not contain symlinks: ${relative(base, path)}`)
  if (info.isDirectory()) {
    for (const name of (await readdir(path)).sort()) await hashFileTree(join(path, name), base, result)
  } else if (info.isFile()) {
    result[relative(base, path).split(sep).join('/')] = createHash('sha256').update(await readFile(path)).digest('hex')
  } else throw new Error(`Unsupported release input: ${relative(base, path)}`)
}

export async function sourceHashes() {
  const result = {}
  const topLevel = (await readdir(root)).filter(name =>
    /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|index\.html|vite\.config\.[cm]?[jt]s|tsconfig(?:\.[\w-]+)?\.json|\.gitignore)$/.test(name))
  for (const name of [...topLevel, 'src', 'public', '.github', 'scripts'].sort()) {
    await hashFileTree(join(root, name), root, result)
  }
  return result
}

export async function siteHashes() {
  const result = {}
  await hashFileTree(siteDirectory, siteDirectory, result)
  return result
}

export function assertMatchingHashes(expected, actual, label) {
  const paths = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()
  const differences = paths.filter(path => expected[path] !== actual[path])
  if (differences.length) throw new Error(`${label} changed; run pnpm release:prepare again: ${differences.slice(0, 8).join(', ')}`)
}
