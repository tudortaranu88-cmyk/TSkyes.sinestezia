// Encoder AAC pe iOS: citește un WAV (PCM) și scrie un .m4a (AAC-LC) cu AVFoundation.
// Echivalentul iOS al AacEncoderModule.kt (Android/MediaCodec).
import ExpoModulesCore
import AVFoundation

public class AacEncoderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AacEncoder")

    AsyncFunction("encodeWavToM4a") { (wavPath: String, outPath: String, bitrate: Int) -> String in
      try AacEncoderModule.encode(AacEncoderModule.strip(wavPath), AacEncoderModule.strip(outPath), bitrate)
      return outPath
    }
  }

  static func strip(_ p: String) -> String {
    return p.hasPrefix("file://") ? String(p.dropFirst("file://".count)) : p
  }

  static func encode(_ wavPath: String, _ outPath: String, _ bitrate: Int) throws {
    let inFile = try AVAudioFile(forReading: URL(fileURLWithPath: wavPath))
    let fmt = inFile.processingFormat

    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: fmt.sampleRate,
      AVNumberOfChannelsKey: fmt.channelCount,
      AVEncoderBitRateKey: bitrate,
    ]

    try? FileManager.default.removeItem(atPath: outPath)
    guard let buffer = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: 8192) else {
      throw NSError(domain: "AacEncoder", code: 1, userInfo: [NSLocalizedDescriptionKey: "Buffer audio indisponibil"])
    }

    // Scoped: fișierul de ieșire se finalizează (își scrie antetul) când iese din scop.
    try autoreleasepool {
      let outFile = try AVAudioFile(forWriting: URL(fileURLWithPath: outPath), settings: settings,
                                    commonFormat: .pcmFormatFloat32, interleaved: false)
      while inFile.framePosition < inFile.length {
        try inFile.read(into: buffer)
        if buffer.frameLength == 0 { break }
        try outFile.write(from: buffer)
      }
    }
  }
}
