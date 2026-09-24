import type { MaxSkill, SkillMatch } from './types'

export type ResolvedSkill = {
  skill: MaxSkill
  match: SkillMatch
}

export class SkillRegistry {
  private readonly skills = new Map<string, MaxSkill>()

  constructor(skills: MaxSkill[] = []) {
    for (const skill of skills) this.register(skill)
  }

  register(skill: MaxSkill): void {
    if (this.skills.has(skill.id)) {
      throw new Error(`Skill já registrada: ${skill.id}`)
    }
    this.skills.set(skill.id, skill)
  }

  unregister(id: string): void {
    this.skills.delete(id)
  }

  resolve(text: string): ResolvedSkill | null {
    const candidates: ResolvedSkill[] = []

    for (const skill of this.skills.values()) {
      const match = skill.match(text)
      if (!match) continue
      candidates.push({ skill, match })
    }

    candidates.sort((a, b) => {
      const confidence = b.match.confidence - a.match.confidence
      if (confidence !== 0) return confidence
      return (b.skill.priority ?? 0) - (a.skill.priority ?? 0)
    })

    return candidates[0] ?? null
  }

  catalog(): Array<{ id: string; description: string; risk: string }> {
    return Array.from(this.skills.values())
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .map(skill => ({
        id: skill.id,
        description: skill.description,
        risk: skill.risk
      }))
  }
}
