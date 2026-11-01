package expo.modules.aacencoder

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

class AacEncoderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AacEncoder")

    AsyncFunction("encodeWavToM4a") { wavPath: String, outPath: String, bitrate: Int ->
      encode(strip(wavPath), strip(outPath), bitrate)
      outPath
    }
  }

  private fun strip(p: String): String = if (p.startsWith("file://")) p.removePrefix("file://") else p

  private fun encode(wavPath: String, outPath: String, bitrate: Int) {
    val bytes = File(wavPath).readBytes()
    val hdr = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
    var pos = 12
    var channels = 1
    var sampleRate = 44100
    var dataOff = -1
    var dataLen = 0
    while (pos + 8 <= bytes.size) {
      val id = String(bytes, pos, 4, Charsets.US_ASCII)
      val size = hdr.getInt(pos + 4)
      if (id == "fmt ") {
        channels = hdr.getShort(pos + 10).toInt()
        sampleRate = hdr.getInt(pos + 12)
      }
      if (id == "data") {
        dataOff = pos + 8
        dataLen = minOf(size, bytes.size - dataOff)
        break
      }
      pos += 8 + size + (size and 1)
    }
    require(dataOff >= 0) { "Fișierul WAV nu conține date audio" }

    val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, channels)
    format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
    format.setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
    format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 65536)

    val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    codec.start()
    File(outPath).delete()
    val muxer = MediaMuxer(outPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    var track = -1
    var muxStarted = false
    val info = MediaCodec.BufferInfo()
    val frameBytes = 2 * channels
    var inOff = 0
    var inputDone = false
    var outputDone = false

    try {
      while (!outputDone) {
        // alimentează encoderul cu toate bufferele de intrare libere (fără așteptare inutilă)
        while (!inputDone) {
          val inIdx = codec.dequeueInputBuffer(if (inOff == 0) 10000L else 0L)
          if (inIdx < 0) break
          val buf = codec.getInputBuffer(inIdx)!!
          buf.clear()
          var n = minOf(buf.remaining(), dataLen - inOff)
          n -= n % frameBytes
          val pts = (inOff.toLong() / frameBytes) * 1_000_000L / sampleRate
          if (n <= 0) {
            codec.queueInputBuffer(inIdx, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
            inputDone = true
          } else {
            buf.put(bytes, dataOff + inOff, n)
            codec.queueInputBuffer(inIdx, 0, n, pts, 0)
            inOff += n
          }
        }
        // golește toate ieșirile disponibile; așteaptă doar dacă nu mai avem ce trimite
        while (true) {
          val outIdx = codec.dequeueOutputBuffer(info, if (inputDone) 10000L else 1000L)
          if (outIdx == MediaCodec.INFO_TRY_AGAIN_LATER) break
          if (outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
            track = muxer.addTrack(codec.outputFormat)
            muxer.start()
            muxStarted = true
            continue
          }
          if (outIdx < 0) continue
          val out = codec.getOutputBuffer(outIdx)!!
          if ((info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) info.size = 0
          if (info.size > 0 && muxStarted) {
            out.position(info.offset)
            out.limit(info.offset + info.size)
            muxer.writeSampleData(track, out, info)
          }
          codec.releaseOutputBuffer(outIdx, false)
          if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) { outputDone = true; break }
        }
      }
    } finally {
      codec.stop()
      codec.release()
      if (muxStarted) muxer.stop()
      muxer.release()
    }
  }
}
