import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeTranscript } from './stt.ts'
import { WakeWordEngine } from './wake-word.ts'

test('descarta ruído repetitivo', () => {
  const garbage = Array.from({ length: 40 }, () => 'não').join(', ')
  assert.equal(sanitizeTranscript(garbage), '')
})

test('preserva frase normal', () => {
  assert.equal(sanitizeTranscript('Abra o Google.'), 'Abra o Google.')
})

test('corrige erros recorrentes de ditado pt-BR', () => {
  assert.equal(sanitizeTranscript('Estam tudo certo.'), 'está tudo certo.')
  assert.equal(sanitizeTranscript('Abram o Google.'), 'abra o Google.')
  assert.equal(sanitizeTranscript('Hey Max, Abram o navegador.'), 'Hey Max, abra o navegador.')
})

test('wake word tolera variações comuns de ditado', () => {
  const engine = new WakeWordEngine()
  assert.equal(engine.detect('Ei Max').detected, true)
  assert.equal(engine.detect('Hey Mais, abra o Google').detected, true)
  assert.equal(engine.detect('conversa comum').detected, false)
})
