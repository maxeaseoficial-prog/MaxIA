import assert from 'node:assert/strict'
import test from 'node:test'
import { SkillRegistry } from '../skills/registry.ts'
import type { MaxSkill } from '../skills/types.ts'

function skill(id: string, confidence: number, priority = 0): MaxSkill {
  return {
    id,
    description: id,
    risk: 'low',
    priority,
    match: text => text.includes(id) ? { confidence } : null,
    async execute() {
      return { kind: 'operational' }
    }
  }
}

test('skill registry escolhe maior confiança', () => {
  const registry = new SkillRegistry([
    skill('google', 0.7, 10),
    {
      ...skill('generic', 0.9, 1),
      match: text => text.includes('google') ? { confidence: 0.9 } : null
    }
  ])

  assert.equal(registry.resolve('abrir google')?.skill.id, 'generic')
})

test('skill registry usa prioridade em empate', () => {
  const registry = new SkillRegistry([
    skill('x', 0.9, 1),
    { ...skill('y', 0.9, 20), match: text => text.includes('x') ? { confidence: 0.9 } : null }
  ])

  assert.equal(registry.resolve('x')?.skill.id, 'y')
})

test('skill registry retorna null quando nada combina', () => {
  const registry = new SkillRegistry([skill('google', 1)])
  assert.equal(registry.resolve('sem comando'), null)
})

test('catálogo expõe metadados sem carregar implementação', () => {
  const registry = new SkillRegistry([skill('google', 1, 10)])
  assert.deepEqual(registry.catalog(), [
    { id: 'google', description: 'google', risk: 'low' }
  ])
})
