import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareSpeechText } from './tts.ts'

test('TTS preserva pontuação real para prosódia natural', () => {
  assert.equal(
    prepareSpeechText('Feito! Tudo certo. Posso ajudar?'),
    'Feito! Tudo certo. Posso ajudar?'
  )
})

test('TTS remove nomes literais de pontuação', () => {
  assert.equal(
    prepareSpeechText('Feito ponto final. Próximo ponto de exclamação!'),
    'Feito. Próximo!'
  )
})

test('TTS remove markdown sem achatar a frase', () => {
  assert.equal(
    prepareSpeechText('**Henrique:** abra o Google, por favor!'),
    'Henrique: abra o Google, por favor!'
  )
})

test('TTS deixa temperatura natural', () => {
  assert.equal(
    prepareSpeechText('Previsão de sol, com 27 °C.'),
    'Previsão de sol, com 27 graus.'
  )
})

test('TTS transforma horário em fala natural', () => {
  assert.equal(
    prepareSpeechText('Agora são 21:30.'),
    'Agora são 21 horas e 30.'
  )
})
