import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const roots = ['apps', 'docs', 'scripts']
const allowed = new Set(['.ts', '.tsx', '.mjs', '.md', '.css', '.html'])
let failed = false

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await walk(path)
    else if (allowed.has(extname(path))) {
      const lines = (await readFile(path, 'utf8')).split('\n')
      lines.forEach((line, index) => {
        if (/\s+$/.test(line) && line.length) {
          console.error(`${path}:${index + 1}: trailing whitespace`)
          failed = true
        }
        if (line.includes('\t')) {
          console.error(`${path}:${index + 1}: tab character`)
          failed = true
        }
      })
    }
  }
}

for (const root of roots) await walk(root)
if (failed) process.exit(1)
console.log('lint: ok')
