import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

if (process.platform !== 'darwin') {
  console.log('native-helpers: skipped (macOS only)')
  process.exit(0)
}

const outputDir = resolve('build/native')
await mkdir(outputDir, { recursive: true })

const targets = [
  {
    name: 'speech-helper',
    source: resolve('apps/desktop/native/speech-helper.swift'),
    frameworks: ['Speech', 'AVFAudio']
  },
  {
    name: 'language-helper',
    source: resolve('apps/desktop/native/language-helper.swift'),
    frameworks: ['FoundationModels']
  }
]

for (const target of targets) {
  const args = ['swiftc', '-parse-as-library', '-O']
  for (const framework of target.frameworks) {
    args.push('-framework', framework)
  }
  args.push(target.source, '-o', resolve(outputDir, target.name))

  try {
    await execFileAsync('/usr/bin/xcrun', args)
    console.log(`native-helpers: built ${target.name}`)
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr) : String(error)
    console.error(stderr)
    console.error(`native-helpers: failed to build ${target.name}. macOS 26 SDK / current Xcode Command Line Tools are required.`)
    process.exit(1)
  }
}
