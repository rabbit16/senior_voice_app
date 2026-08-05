package com.seniorvoiceapp

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 使用 AudioRecord 录制 16-bit mono PCM，并写成 WAV，供 /qa/ask/audio 上传。
 */
class WavAudioRecorderModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val recording = AtomicBoolean(false)
  private var audioRecord: AudioRecord? = null
  private var recordThread: Thread? = null
  private var pcmFile: File? = null
  private var sampleRateHz: Int = 16000

  override fun getName(): String = "WavAudioRecorder"

  @ReactMethod
  fun start(sampleRate: Int, promise: Promise) {
    if (recording.get()) {
      promise.reject("already_recording", "正在录音中")
      return
    }

    val rate = if (sampleRate > 0) sampleRate else 16000
    val channelConfig = AudioFormat.CHANNEL_IN_MONO
    val audioFormat = AudioFormat.ENCODING_PCM_16BIT
    val minBuffer = AudioRecord.getMinBufferSize(rate, channelConfig, audioFormat)
    if (minBuffer == AudioRecord.ERROR || minBuffer == AudioRecord.ERROR_BAD_VALUE) {
      promise.reject("init_failed", "无法初始化麦克风")
      return
    }

    val bufferSize = minBuffer * 2
    val recorder =
      try {
        AudioRecord(
          MediaRecorder.AudioSource.VOICE_RECOGNITION,
          rate,
          channelConfig,
          audioFormat,
          bufferSize,
        )
      } catch (error: SecurityException) {
        promise.reject("permission_denied", "未获得麦克风权限", error)
        return
      } catch (error: Exception) {
        promise.reject("init_failed", error.message ?: "麦克风初始化失败", error)
        return
      }

    if (recorder.state != AudioRecord.STATE_INITIALIZED) {
      recorder.release()
      promise.reject("init_failed", "麦克风未就绪")
      return
    }

    val out =
      try {
        File.createTempFile("sv_rec_", ".pcm", reactContext.cacheDir)
      } catch (error: IOException) {
        recorder.release()
        promise.reject("io_error", "无法创建临时文件", error)
        return
      }

    sampleRateHz = rate
    pcmFile = out
    audioRecord = recorder
    recording.set(true)

    try {
      recorder.startRecording()
    } catch (error: Exception) {
      cleanupLocked()
      promise.reject("start_failed", error.message ?: "开始录音失败", error)
      return
    }

    recordThread =
      Thread {
        val buffer = ByteArray(bufferSize)
        FileOutputStream(out).use { fos ->
          while (recording.get()) {
            val read = recorder.read(buffer, 0, buffer.size)
            if (read > 0) {
              fos.write(buffer, 0, read)
            }
          }
        }
      }.also {
        it.isDaemon = true
        it.start()
      }

    promise.resolve(null)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    if (!recording.get() && audioRecord == null) {
      promise.reject("not_recording", "尚未开始录音")
      return
    }

    recording.set(false)
    try {
      audioRecord?.stop()
    } catch (_: Exception) {
      // ignore
    }
    try {
      recordThread?.join(3000)
    } catch (_: InterruptedException) {
      // ignore
    }

    val pcm = pcmFile
    val rate = sampleRateHz
    cleanupLocked()

    if (pcm == null || !pcm.exists()) {
      promise.reject("io_error", "录音文件丢失")
      return
    }

    try {
      val wav = File.createTempFile("sv_rec_", ".wav", reactContext.cacheDir)
      writeWav(pcm, wav, rate)
      pcm.delete()
      promise.resolve(wav.absolutePath)
    } catch (error: Exception) {
      pcm.delete()
      promise.reject("encode_failed", error.message ?: "WAV 编码失败", error)
    }
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    recording.set(false)
    try {
      audioRecord?.stop()
    } catch (_: Exception) {
      // ignore
    }
    try {
      recordThread?.join(1500)
    } catch (_: InterruptedException) {
      // ignore
    }
    pcmFile?.delete()
    cleanupLocked()
    promise.resolve(null)
  }

  private fun cleanupLocked() {
    try {
      audioRecord?.release()
    } catch (_: Exception) {
      // ignore
    }
    audioRecord = null
    recordThread = null
    pcmFile = null
  }

  private fun writeWav(pcmFile: File, wavFile: File, sampleRate: Int) {
    val pcmBytes = pcmFile.length().toInt()
    val channels = 1
    val bitsPerSample = 16
    val byteRate = sampleRate * channels * bitsPerSample / 8
    val blockAlign = (channels * bitsPerSample / 8).toShort()

    FileOutputStream(wavFile).use { out ->
      val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
      header.put("RIFF".toByteArray(Charsets.US_ASCII))
      header.putInt(36 + pcmBytes)
      header.put("WAVE".toByteArray(Charsets.US_ASCII))
      header.put("fmt ".toByteArray(Charsets.US_ASCII))
      header.putInt(16)
      header.putShort(1) // PCM
      header.putShort(channels.toShort())
      header.putInt(sampleRate)
      header.putInt(byteRate)
      header.putShort(blockAlign)
      header.putShort(bitsPerSample.toShort())
      header.put("data".toByteArray(Charsets.US_ASCII))
      header.putInt(pcmBytes)
      out.write(header.array())

      FileInputStream(pcmFile).use { input ->
        val buffer = ByteArray(8192)
        while (true) {
          val read = input.read(buffer)
          if (read <= 0) {
            break
          }
          out.write(buffer, 0, read)
        }
      }
    }
  }
}
