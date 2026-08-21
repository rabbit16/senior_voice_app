package com.seniorvoiceapp

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

/**
 * 相册 / 拍照选图，返回缓存文件路径供 /archives/ocr 上传。
 */
class ImagePickerModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  private var pickerPromise: Promise? = null
  private var cameraFile: File? = null

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = "ImagePicker"

  @ReactMethod
  fun pick(source: String, promise: Promise) {
    val activity =
      reactContext.currentActivity
        ?: run {
          promise.reject("no_activity", "当前没有可用页面，请重试")
          return
        }
    if (pickerPromise != null) {
      promise.reject("busy", "正在选择图片")
      return
    }
    pickerPromise = promise
    cameraFile = null

    try {
      if (source == "camera") {
        launchCamera(activity)
      } else {
        launchAlbum(activity)
      }
    } catch (error: Exception) {
      finishReject("failed", error.message ?: "无法打开选图")
    }
  }

  private fun launchAlbum(activity: Activity) {
    val intent =
      Intent(Intent.ACTION_GET_CONTENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "image/*"
        putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/jpeg", "image/png", "image/webp", "image/gif"))
      }
    activity.startActivityForResult(Intent.createChooser(intent, "选择图片"), REQUEST_ALBUM)
  }

  private fun launchCamera(activity: Activity) {
    val imagesDir = File(reactContext.cacheDir, "images").apply { mkdirs() }
    val photo = File(imagesDir, "capture_${System.currentTimeMillis()}.jpg")
    cameraFile = photo
    val uri =
      FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", photo)
    val intent =
      Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
        putExtra(MediaStore.EXTRA_OUTPUT, uri)
        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
    val matches =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        activity.packageManager.queryIntentActivities(
          intent,
          PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong()),
        )
      } else {
        @Suppress("DEPRECATION")
        activity.packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
      }
    if (matches.isEmpty()) {
      photo.delete()
      cameraFile = null
      finishReject("unsupported", "未找到可用的相机应用")
      return
    }
    for (info in matches) {
      activity.grantUriPermission(
        info.activityInfo.packageName,
        uri,
        Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION,
      )
    }
    activity.startActivityForResult(intent, REQUEST_CAMERA)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_ALBUM && requestCode != REQUEST_CAMERA) {
      return
    }
    if (resultCode != Activity.RESULT_OK) {
      cameraFile?.delete()
      cameraFile = null
      finishReject("cancelled", "cancelled")
      return
    }

    Thread {
      try {
        val file =
          if (requestCode == REQUEST_CAMERA) {
            val captured = cameraFile
            if (captured == null || !captured.exists() || captured.length() <= 0L) {
              throw IOException("拍照失败，请重试")
            }
            captured
          } else {
            val uri = data?.data ?: throw IOException("未选择图片")
            copyUriToCache(uri)
          }
        cameraFile = null
        if (file.length() > MAX_BYTES) {
          file.delete()
          finishReject("image_too_large", "图片超过 10MB，请换一张更小的照片")
          return@Thread
        }
        val mime = guessMime(file.name)
        val map =
          Arguments.createMap().apply {
            putString("uri", toFileUri(file.absolutePath))
            putString("type", mime)
            putString("name", file.name)
          }
        val pending = pickerPromise
        pickerPromise = null
        pending?.resolve(map)
      } catch (error: Exception) {
        cameraFile?.delete()
        cameraFile = null
        finishReject("failed", error.message ?: "读取图片失败")
      }
    }.start()
  }

  override fun onNewIntent(intent: Intent) {}

  private fun copyUriToCache(uri: Uri): File {
    val mime = reactContext.contentResolver.getType(uri) ?: "image/jpeg"
    val ext =
      when {
        mime.contains("png") -> ".png"
        mime.contains("webp") -> ".webp"
        mime.contains("gif") -> ".gif"
        else -> ".jpg"
      }
    val imagesDir = File(reactContext.cacheDir, "images").apply { mkdirs() }
    val out = File(imagesDir, "ocr_${System.currentTimeMillis()}$ext")
    val input =
      reactContext.contentResolver.openInputStream(uri)
        ?: throw IOException("无法读取所选图片")
    input.use { src ->
      FileOutputStream(out).use { dst -> src.copyTo(dst) }
    }
    if (out.length() <= 0L) {
      out.delete()
      throw IOException("图片是空的，请另选一张")
    }
    return out
  }

  private fun finishReject(code: String, message: String) {
    val pending = pickerPromise
    pickerPromise = null
    pending?.reject(code, message)
  }

  companion object {
    private const val REQUEST_ALBUM = 0x51A1
    private const val REQUEST_CAMERA = 0x51A2
    private const val MAX_BYTES = 10L * 1024L * 1024L

    private fun toFileUri(path: String): String =
      if (path.startsWith("file://")) path else "file://$path"

    private fun guessMime(name: String): String {
      val lower = name.lowercase()
      return when {
        lower.endsWith(".png") -> "image/png"
        lower.endsWith(".webp") -> "image/webp"
        lower.endsWith(".gif") -> "image/gif"
        else -> "image/jpeg"
      }
    }
  }
}
