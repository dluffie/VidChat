package com.videoshare

import android.os.Environment
import android.os.StatFs
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class StorageModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "StorageModule"

  @ReactMethod
  fun getStorageInfo(promise: Promise) {
    try {
      val path = Environment.getDataDirectory().path
      val stat = StatFs(path)
      val blockSize = stat.blockSizeLong
      val availableBlocks = stat.availableBlocksLong
      val totalBlocks = stat.blockCountLong

      val freeBytes = (availableBlocks * blockSize).toDouble()
      val totalBytes = (totalBlocks * blockSize).toDouble()

      val map = Arguments.createMap().apply {
        putDouble("freeBytes", freeBytes)
        putDouble("totalBytes", totalBytes)
      }

      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("STORAGE_ERROR", e.message, e)
    }
  }
}
