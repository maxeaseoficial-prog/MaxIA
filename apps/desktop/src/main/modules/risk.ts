export type RiskLevel = 'low' | 'medium' | 'high'

export type ActionRisk = {
  level: RiskLevel
  requiresExplicitConfirmation: boolean
  reason: string
}

export class RiskPolicy {
  assess(action: string): ActionRisk {
    if (/pagamento|pagar|comprar|senha|excluir permanentemente|apagar permanentemente/i.test(action)) {
      return { level: 'high', requiresExplicitConfirmation: true, reason: 'Ação crítica, financeira, secreta ou irreversível.' }
    }
    if (/enviar mensagem|publicar|editar arquivo|sobrescrever/i.test(action)) {
      return { level: 'medium', requiresExplicitConfirmation: true, reason: 'Ação com impacto externo ou alteração persistente.' }
    }
    return { level: 'low', requiresExplicitConfirmation: false, reason: 'Ação local reversível/de leitura.' }
  }
}
