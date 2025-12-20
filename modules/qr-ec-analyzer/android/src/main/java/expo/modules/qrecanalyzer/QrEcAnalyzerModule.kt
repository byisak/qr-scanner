package expo.modules.qrecanalyzer

import android.graphics.BitmapFactory
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.zxing.*
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import java.io.File
import java.io.FileInputStream

class QrEcAnalyzerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QrEcAnalyzer")

    AsyncFunction("analyzeQrCode") { imagePath: String, promise: Promise ->
      try {
        val result = analyzeQrCodeInternal(imagePath)
        promise.resolve(result)
      } catch (e: Exception) {
        promise.resolve(mapOf(
          "success" to false,
          "error" to (e.message ?: "Unknown error")
        ))
      }
    }
  }

  private fun analyzeQrCodeInternal(imagePath: String): Map<String, Any?> {
    // Load the image
    val file = File(imagePath)
    if (!file.exists()) {
      return mapOf(
        "success" to false,
        "error" to "File not found: $imagePath"
      )
    }

    val inputStream = FileInputStream(file)
    val bitmap = BitmapFactory.decodeStream(inputStream)
    inputStream.close()

    if (bitmap == null) {
      return mapOf(
        "success" to false,
        "error" to "Failed to decode image"
      )
    }

    // Convert bitmap to ZXing format
    val width = bitmap.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

    val source = RGBLuminanceSource(width, height, pixels)
    val binaryBitmap = BinaryBitmap(HybridBinarizer(source))

    // Configure hints for better decoding
    val hints = mutableMapOf<DecodeHintType, Any>()
    hints[DecodeHintType.TRY_HARDER] = true
    hints[DecodeHintType.POSSIBLE_FORMATS] = listOf(BarcodeFormat.QR_CODE)

    // Try to decode
    val reader = QRCodeReader()

    return try {
      val result = reader.decode(binaryBitmap, hints)

      // Extract EC level from metadata
      val metadata = result.resultMetadata
      var ecLevel: String? = null

      if (metadata != null) {
        val ecLevelObj = metadata[ResultMetadataType.ERROR_CORRECTION_LEVEL]
        if (ecLevelObj != null) {
          ecLevel = ecLevelObj.toString()
        }
      }

      mapOf(
        "success" to true,
        "data" to result.text,
        "ecLevel" to ecLevel
      )
    } catch (e: NotFoundException) {
      // Try with inverted image
      tryWithInvertedImage(source, hints)
    } catch (e: Exception) {
      mapOf(
        "success" to false,
        "error" to (e.message ?: "Decoding failed")
      )
    } finally {
      bitmap.recycle()
    }
  }

  private fun tryWithInvertedImage(
    source: RGBLuminanceSource,
    hints: Map<DecodeHintType, Any>
  ): Map<String, Any?> {
    return try {
      val invertedSource = source.invert()
      val binaryBitmap = BinaryBitmap(HybridBinarizer(invertedSource))
      val reader = QRCodeReader()
      val result = reader.decode(binaryBitmap, hints)

      val metadata = result.resultMetadata
      var ecLevel: String? = null

      if (metadata != null) {
        val ecLevelObj = metadata[ResultMetadataType.ERROR_CORRECTION_LEVEL]
        if (ecLevelObj != null) {
          ecLevel = ecLevelObj.toString()
        }
      }

      mapOf(
        "success" to true,
        "data" to result.text,
        "ecLevel" to ecLevel
      )
    } catch (e: Exception) {
      mapOf(
        "success" to false,
        "error" to "No QR code found"
      )
    }
  }
}
