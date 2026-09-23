import AVFAudio
import Foundation
import Speech

struct Request: Codable {
    let id: Int
    let path: String
}

struct Response: Codable {
    let id: Int
    let ok: Bool
    let text: String?
    let error: String?
}

@available(macOS 26.0, *)
func transcribeFile(path: String) async throws -> String {
    let file = try AVAudioFile(forReading: URL(fileURLWithPath: path))
    let locale = Locale(identifier: "pt_BR")

    // Frases curtas são o caso principal da MAX: wake word, comandos e perguntas rápidas.
    let transcriber = DictationTranscriber(locale: locale, preset: .phrase)

    let context = AnalysisContext()
    context.contextualStrings[.general] = [
        "Hey Max",
        "Ei Max",
        "Max",
        "Henrique",
        "abra",
        "abrir",
        "abre",
        "Google",
        "Chrome",
        "navegador",
        "WhatsApp",
        "cérebro",
        "descansar",
        "microfone",
        "câmera",
        "configurações",
        "está"
    ]

    async let transcriptionFuture = try transcriber.results.reduce(AttributedString()) {
        partial, result in
        partial + result.text
    }

    let options = SpeechAnalyzer.Options(
        priority: .userInitiated,
        modelRetention: .processLifetime
    )

    let analyzer = SpeechAnalyzer(modules: [transcriber], options: options)
    try await analyzer.setContext(context)
    try await analyzer.prepareToAnalyze(in: file.processingFormat)

    if let lastSample = try await analyzer.analyzeSequence(from: file) {
        try await analyzer.finalizeAndFinish(through: lastSample)
    } else {
        await analyzer.cancelAndFinishNow()
    }

    let attributed = try await transcriptionFuture
    return String(attributed.characters)
}

func emit(_ response: Response) {
    let encoder = JSONEncoder()
    guard let data = try? encoder.encode(response),
          let line = String(data: data, encoding: .utf8) else {
        return
    }
    print(line)
    fflush(stdout)
}

@main
struct NativeSpeechHelper {
    static func main() async {
        guard #available(macOS 26.0, *) else {
            fputs("MAX native speech requires macOS 26 or newer.\n", stderr)
            exit(2)
        }

        while let line = readLine() {
            guard let data = line.data(using: .utf8) else { continue }

            do {
                let request = try JSONDecoder().decode(Request.self, from: data)
                let text = try await transcribeFile(path: request.path)
                emit(Response(id: request.id, ok: true, text: text, error: nil))
            } catch {
                let fallbackId = (try? JSONDecoder().decode(Request.self, from: data).id) ?? -1
                emit(Response(
                    id: fallbackId,
                    ok: false,
                    text: nil,
                    error: String(describing: error)
                ))
            }
        }
    }
}
