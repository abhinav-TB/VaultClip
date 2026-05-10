import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const SOURCE_ROOT = path.join(ROOT, 'src')

const MAX_LINES_BY_PATH = [
  { pattern: /src\/components\/.*\.tsx$/, max: 500, label: 'React component' },
  { pattern: /src\/workers\/.*\.ts$/, max: 350, label: 'Worker module' },
  { pattern: /src\/store\/slices\/.*\.ts$/, max: 250, label: 'Redux slice' },
]

const BANNED_PATTERNS = [
  { pattern: /@ts-ignore/, label: '@ts-ignore' },
  { pattern: /eslint-disable(?!-next-line)/, label: 'blanket eslint-disable' },
  { pattern: /\bTODO\b|\bFIXME\b/, label: 'unresolved TODO/FIXME' },
]

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

function toRepoPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/')
}

const failures = []

for (const filePath of walk(SOURCE_ROOT)) {
  const repoPath = toRepoPath(filePath)
  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/)

  for (const rule of MAX_LINES_BY_PATH) {
    if (rule.pattern.test(repoPath) && lines.length > rule.max) {
      failures.push(`${repoPath}: ${rule.label} has ${lines.length} lines; limit is ${rule.max}. Split or extract shared logic.`)
    }
  }

  lines.forEach((line, index) => {
    for (const rule of BANNED_PATTERNS) {
      if (rule.pattern.test(line)) {
        failures.push(`${repoPath}:${index + 1}: Avoid ${rule.label}; resolve the issue or document a narrower exception.`)
      }
    }
  })
}

if (failures.length > 0) {
  console.error('Code standards check failed:\n')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Code standards check passed.')
