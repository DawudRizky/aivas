import path from 'path'

export function safeResolve(baseDir: string, requested: string) {
  const resolved = path.resolve(baseDir, requested)
  const baseResolved = path.resolve(baseDir) + path.sep
  if (!resolved.startsWith(baseResolved)) {
    throw new Error('Invalid file path')
  }
  return resolved
}

export default { safeResolve }
