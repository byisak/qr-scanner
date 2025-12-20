import ExpoModulesCore
import ZXingObjC
import UIKit

public class QrEcAnalyzerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QrEcAnalyzer")

    AsyncFunction("analyzeQrCode") { (imagePath: String, promise: Promise) in
      self.analyzeQrCodeInternal(imagePath: imagePath, promise: promise)
    }
  }

  private func analyzeQrCodeInternal(imagePath: String, promise: Promise) {
    DispatchQueue.global(qos: .userInitiated).async {
      // Load image from path
      guard let image = UIImage(contentsOfFile: imagePath) else {
        promise.resolve([
          "success": false,
          "error": "Failed to load image from path: \(imagePath)"
        ])
        return
      }

      guard let cgImage = image.cgImage else {
        promise.resolve([
          "success": false,
          "error": "Failed to get CGImage"
        ])
        return
      }

      // Create ZXing luminance source
      guard let source = ZXCGImageLuminanceSource(cgImage: cgImage) else {
        promise.resolve([
          "success": false,
          "error": "Failed to create luminance source"
        ])
        return
      }

      guard let binarizer = ZXHybridBinarizer(source: source) else {
        promise.resolve([
          "success": false,
          "error": "Failed to create binarizer"
        ])
        return
      }

      guard let bitmap = ZXBinaryBitmap(binarizer: binarizer) else {
        promise.resolve([
          "success": false,
          "error": "Failed to create binary bitmap"
        ])
        return
      }

      // Configure hints
      let hints = ZXDecodeHints()
      hints?.tryHarder = true

      // Try to decode
      let reader = ZXQRCodeReader()

      var result: ZXResult? = nil

      do {
        result = try reader.decode(bitmap, hints: hints)
      } catch {
        // Try with inverted image
        if let invertedSource = source.invert(),
           let invertedBinarizer = ZXHybridBinarizer(source: invertedSource),
           let invertedBitmap = ZXBinaryBitmap(binarizer: invertedBinarizer) {
          result = try? reader.decode(invertedBitmap, hints: hints)
        }
      }

      if let result = result {
        var ecLevel: String? = nil

        // Extract EC level from result metadata using Objective-C constant
        if let metadata = result.resultMetadata {
          // kResultMetadataTypeErrorCorrectionLevel = 3
          let ecLevelKey = NSNumber(value: 3)
          if let ecLevelValue = metadata.object(forKey: ecLevelKey) {
            ecLevel = String(describing: ecLevelValue)
          }
        }

        promise.resolve([
          "success": true,
          "data": result.text ?? "",
          "ecLevel": ecLevel as Any
        ])
      } else {
        promise.resolve([
          "success": false,
          "error": "No QR code found"
        ])
      }
    }
  }
}
