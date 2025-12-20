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
      do {
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
        let source = ZXCGImageLuminanceSource(cgImage: cgImage)
        let binarizer = ZXHybridBinarizer(source: source)
        let bitmap = ZXBinaryBitmap(binarizer: binarizer)

        // Configure hints
        let hints = ZXDecodeHints()
        hints.tryHarder = true

        // Try to decode
        let reader = ZXQRCodeReader()

        var result: ZXResult?
        var error: NSError?

        result = try? reader.decode(bitmap, hints: hints)

        if result == nil {
          // Try with inverted image
          if let invertedSource = source?.invert() {
            let invertedBinarizer = ZXHybridBinarizer(source: invertedSource)
            let invertedBitmap = ZXBinaryBitmap(binarizer: invertedBinarizer)
            result = try? reader.decode(invertedBitmap, hints: hints)
          }
        }

        if let result = result {
          var ecLevel: String? = nil

          // Extract EC level from result metadata
          if let metadata = result.resultMetadata {
            if let ecLevelValue = metadata[NSNumber(value: ZXResultMetadataType.errorCorrectionLevel.rawValue)] {
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
      } catch {
        promise.resolve([
          "success": false,
          "error": error.localizedDescription
        ])
      }
    }
  }
}
