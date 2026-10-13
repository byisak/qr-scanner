// Apple Vision 데이터 매트릭스 판독 벤치 (macOS): swiftc -O vision-test.swift -o /tmp/vtest && /tmp/vtest <사진>
// 프레임 크기별로 전체 / 전체 반전 / 가운데 60% 2배 확대(iOS 보조 판독 방식)를 비교한다

import Foundation
import Vision
import CoreImage

let src = CIImage(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))!
func detect(_ img: CIImage) -> [String] {
  let req = VNDetectBarcodesRequest()
  req.revision = VNDetectBarcodesRequestRevision3
  req.symbologies = [.dataMatrix]
  try? VNImageRequestHandler(ciImage: img, options: [:]).perform([req])
  return (req.results ?? []).compactMap { $0.payloadStringValue }
}
for short in [1080.0, 1440.0, 2160.0] {
  let s = short / min(src.extent.width, src.extent.height)
  let frame = src.transformed(by: CGAffineTransform(scaleX: s, y: s))
  let w = frame.extent.width, h = frame.extent.height
  let side = floor(min(w, h) * 0.6)
  let crop = CGRect(x: floor((w - side) / 2), y: floor((h - side) / 2), width: side, height: side)
  let c2 = frame.cropped(to: crop).transformed(by: CGAffineTransform(translationX: -crop.origin.x, y: -crop.origin.y)).transformed(by: CGAffineTransform(scaleX: 2, y: 2))
  print("short=\(Int(short)) 전체=\(detect(frame)) 전체반전=\(detect(frame.applyingFilter("CIColorInvert"))) 가운데2배=\(detect(c2)) 가운데2배반전=\(detect(c2.applyingFilter("CIColorInvert")))")
}
