import assert from 'node:assert/strict'
import test from 'node:test'
import { shapeAssistantReply, shapeWeatherReply } from './response-style.ts'

test('tempo com chuva fica direto', () => {
  const result = shapeWeatherReply(
    'Hoje teremos chuva. A máxima será de 22 °C e a mínima de 16 °C. A chance de chuva é de 80%. Pressão de 1015 hPa.'
  )
  assert.equal(
    result,
    'Previsão de chuva, com máxima de 22 graus e mínima de 16 graus e chance de chuva de 80 por cento.'
  )
})

test('tempo com sol fica direto', () => {
  const result = shapeWeatherReply(
    'Tempo ensolarado. Temperatura atual de 27 °C. Índice UV 8 e pressão 1012 hPa.'
  )
  assert.equal(result, 'Previsão de sol, com 27 graus.')
})

test('resposta comum fica curta', () => {
  const result = shapeAssistantReply(
    'me explique outbound',
    'Outbound é prospecção ativa. Você vai até o potencial cliente. É útil para acelerar aquisição. Existem várias técnicas adicionais.'
  )
  assert.equal(
    result,
    'Outbound é prospecção ativa. Você vai até o potencial cliente. É útil para acelerar aquisição.'
  )
})
