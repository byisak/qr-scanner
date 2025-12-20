Pod::Spec.new do |s|
  s.name           = 'QrEcAnalyzer'
  s.version        = '1.0.0'
  s.summary        = 'QR Code EC Level Analyzer using ZXing'
  s.description    = 'Analyzes QR codes and extracts error correction level using ZXingObjC'
  s.author         = 'QR Scanner'
  s.homepage       = 'https://github.com/example/qr-ec-analyzer'
  s.platform       = :ios, '13.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'ZXingObjC', '~> 3.6'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
