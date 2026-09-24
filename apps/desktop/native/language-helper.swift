import Foundation
import FoundationModels

struct LanguageRequest: Codable {
    let id: Int
    let prompt: String
}

struct LanguageResponse: Codable {
    let id: Int
    let ok: Bool
    let text: String?
    let error: String?
}

@available(macOS 26.0, *)
final class MaxLanguageEngine {
    private let model: SystemLanguageModel
    private let session: LanguageModelSession

    init() throws {
        let model = SystemLanguageModel.default
        guard model.isAvailable else {
            throw NSError(
                domain: "MAX.FoundationModels",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey:
                    "O modelo local da Apple não está disponível. Ative o Apple Intelligence nos Ajustes do Sistema."]
            )
        }

        self.model = model
        self.session = LanguageModelSession(
            model: model,
            instructions: """
            Você é MAX, o assistente local de IA do Henrique.
            Responda sempre em português do Brasil.
            Fale como um assistente de voz: frases curtas, naturais e fáceis de entender.
            Por padrão, responda em no máximo duas ou três frases.
            Vá direto à resposta. Não faça introduções, conclusões ou explicações técnicas sem necessidade.
            Chame o usuário de Henrique somente quando soar natural.
            Nunca use markdown, listas, títulos, emojis ou símbolos decorativos em respostas faladas.
            Nunca diga "Feito." em conversa comum; "Feito." é reservado a ações operacionais concluídas.
            Se não souber algo, diga com clareza em vez de inventar.

            Para previsão do tempo, responda de forma especialmente curta.
            Comece pelo estado principal: "Previsão de chuva", "Previsão de sol" ou "Previsão de tempo nublado".
            Em seguida informe somente o que importa: temperatura, máxima, mínima e chance de chuva, quando esses dados estiverem disponíveis.
            Não fale pressão atmosférica, hPa, ponto de orvalho, cobertura de nuvens, índice UV, visibilidade, direção do vento ou outros termos meteorológicos técnicos, a menos que Henrique peça especificamente.
            Exemplo: "Previsão de chuva, com máxima de 22 graus e mínima de 16 graus. Chance de chuva de 80 por cento."
            Exemplo: "Previsão de sol, com 27 graus."
            """
        )
    }

    func answer(_ prompt: String) async throws -> String {
        let response = try await session.respond(to: prompt)
        return response.content.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

func emitLanguage(_ response: LanguageResponse) {
    let encoder = JSONEncoder()
    guard let data = try? encoder.encode(response),
          let line = String(data: data, encoding: .utf8) else {
        return
    }

    print(line)
    fflush(stdout)
}

@main
struct NativeLanguageHelper {
    static func main() async {
        guard #available(macOS 26.0, *) else {
            fputs("MAX local language model requires macOS 26 or newer.\n", stderr)
            exit(2)
        }

        let engine: MaxLanguageEngine
        do {
            engine = try MaxLanguageEngine()
        } catch {
            fputs("MAX Foundation Models unavailable: \(error)\n", stderr)
            exit(3)
        }

        while let line = readLine() {
            guard let data = line.data(using: .utf8) else { continue }

            do {
                let request = try JSONDecoder().decode(LanguageRequest.self, from: data)
                let text = try await engine.answer(request.prompt)
                emitLanguage(LanguageResponse(id: request.id, ok: true, text: text, error: nil))
            } catch {
                let fallbackId = (try? JSONDecoder().decode(LanguageRequest.self, from: data).id) ?? -1
                emitLanguage(LanguageResponse(
                    id: fallbackId,
                    ok: false,
                    text: nil,
                    error: String(describing: error)
                ))
            }
        }
    }
}
