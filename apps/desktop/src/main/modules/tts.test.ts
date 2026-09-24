import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareSpeechText } from './tts.ts'

test('TTS remove pontuação que o macOS poderia anunciar', () => {
  assert.equal(
    prepareSpeechText('Feito! Tudo certo. Posso ajudar?'),
    'Feito\nTudo certo\nPosso ajudar'
  )
})

test('TTS remove markdown e símbolos de leitura', () => {
  assert.equal(
    prepareSpeechText('**Henrique:** abra o Google, por favor!'),
    'Henrique abra o Google por favor'
  )
})

test('TTS transforma horário em fala natural', () => {
  assert.equal(
    prepareSpeechText('Agora são 21:30.'),
    'Agora são 21 horas e 30'
  )
})
