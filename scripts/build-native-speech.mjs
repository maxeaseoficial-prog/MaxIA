import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

if (process.platform !== 'darwin') {
  console.log('native-speech: skipped (macOS only)')
  process.exit(0)
}

const source = resolve('apps/desktop/native/speech-helper.swift')
const outputDir = resolve('build/native')
const output = resolve(outputDir, 'speech-helper')

await mkdir(outputDir, { recursive: true })

try {
  await execFileAsync('/usr/bin/xcrun', [
    'swiftc',
    '-parse-as-library',
    '-O',
    '-framework',
    'Speech',
    '-framework',
    'AVFAudio',
    source,
    '-o',
    output
  ])

  console.log(`native-speech: built ${output}`)
} catch (error) {
  const stderr = error?.stderr ? String(error.stderr) : String(error)
  console.error(stderr)
  console.error('native-speech: requires macOS 26 SDK / Xcode Command Line Tools compatible with SpeechAnalyzer.')
  process.exit(1)
}
