Pod::Spec.new do |s|
  s.name           = 'AacEncoder'
  s.version        = '0.1.0'
  s.summary        = 'WAV → AAC (.m4a) pentru Music&Color'
  s.description    = s.summary
  s.author         = ''
  s.homepage       = 'https://github.com/tudortaranu88-cmyk/TSkyes.sinestezia'
  s.license        = { type: 'MIT' }
  s.platforms      = { ios: '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
end
