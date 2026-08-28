package com.seniorvoiceapp

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
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
        val prepared = prepareForUpload(file)
        if (prepared !== file && file.exists()) {
          file.delete()
        }
        if (prepared.length() > MAX_BYTES) {
          prepared.delete()
          finishReject("image_too_large", "图片超过 10MB，请换一张更小的照片")
          return@Thread
        }
        val map =
          Arguments.createMap().apply {
            putString("uri", toContentUri(prepared))
            putString("type", guessMime(prepared.name))
            putString("name", prepared.name)
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

  /**
   * 相机原图经常 5～12MB。走 natapp 上传会被掐断，App 就会显示「连不上」。
   * 压到约 1920 边长的 JPEG，OCR 仍然够用。
   * 同时改成 FileProvider 的 content://，避免 OkHttp 读 file:// 失败。
   */
  private fun prepareForUpload(src: File): File {
    if (src.length() <= SMALL_JPEG_BYTES && src.name.lowercase().endsWith(".jpg")) {
      return src
    }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(src.absolutePath, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      return src
    }
    var sample = 1
    while (bounds.outWidth / sample > MAX_SIDE || bounds.outHeight / sample > MAX_SIDE) {
      sample *= 2
    }
    val bitmap =
      BitmapFactory.decodeFile(src.absolutePath, BitmapFactory.Options().apply { inSampleSize = sample })
        ?: return src
    val oriented = rotateByExif(src.absolutePath, bitmap)
    val imagesDir = File(reactContext.cacheDir, "images").apply { mkdirs() }
    val out = File(imagesDir, "ocr_${System.currentTimeMillis()}.jpg")
    try {
      FileOutputStream(out).use { fos ->
        if (!oriented.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, fos)) {
          throw IOException("压缩图片失败")
        }
      }
    } catch (error: Exception) {
      out.delete()
      recycleBitmaps(bitmap, oriented)
      return src
    }
    recycleBitmaps(bitmap, oriented)
    return if (out.length() > 0L) out else src
  }

  private fun toContentUri(file: File): String =
    FileProvider.getUriForFile(reactContext, "${reactContext.packageName}.fileprovider", file).toString()

  companion object {
    private const val REQUEST_ALBUM = 0x51A1
    private const val REQUEST_CAMERA = 0x51A2
    private const val MAX_BYTES = 10L * 1024L * 1024L
    private const val SMALL_JPEG_BYTES = 400L * 1024L
    private const val MAX_SIDE = 1920
    private const val JPEG_QUALITY = 80

    private fun rotateByExif(path: String, bitmap: Bitmap): Bitmap {
      val orientation =
        try {
          ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        } catch (_: Exception) {
          return bitmap
        }
      val degrees =
        when (orientation) {
          ExifInterface.ORIENTATION_ROTATE_90 -> 90f
          ExifInterface.ORIENTATION_ROTATE_180 -> 180f
          ExifInterface.ORIENTATION_ROTATE_270 -> 270f
          else -> return bitmap
        }
      val matrix = Matrix().apply { postRotate(degrees) }
      return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    private fun recycleBitmaps(original: Bitmap, oriented: Bitmap) {
      if (oriented !== original && !oriented.isRecycled) {
        oriented.recycle()
      }
      if (!original.isRecycled) {
        original.recycle()
      }
    }

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
