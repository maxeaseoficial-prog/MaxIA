import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyCommand, hasWakeWord, normalizeText, stripWakeWord } from './intent.ts'

test('normaliza acentos e caixa', () => {
  assert.equal(normalizeText('ÁBRA o Cérebro!'), 'abra o cerebro')
})

test('detecta wake word', () => {
  assert.equal(hasWakeWord('Hey Max, abra o Google'), true)
  assert.equal(hasWakeWord('conversa comum'), false)
})

test('remove wake word e classifica Google', () => {
  assert.equal(stripWakeWord('Hey Max, abra o Google'), 'abra o google')
  assert.deepEqual(classifyCommand('Hey Max, abra o Google'), { type: 'open-google' })
})

test('classifica descanso e cérebro', () => {
  assert.deepEqual(classifyCommand('Hey Max, descansar'), { type: 'sleep' })
  assert.deepEqual(classifyCommand('Abra seu cérebro'), { type: 'open-brain' })
})
