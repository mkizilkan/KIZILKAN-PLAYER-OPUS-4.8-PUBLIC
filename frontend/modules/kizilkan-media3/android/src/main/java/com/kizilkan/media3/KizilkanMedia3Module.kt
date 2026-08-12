package com.kizilkan.media3

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KizilkanMedia3Module : Module() {
  override fun definition() = ModuleDefinition {
    Name("KizilkanMedia3")

    View(KizilkanMedia3View::class) {
      Events("onFirstFrame", "onStateChange", "onError", "onVideoSize")
      Prop("headers") { view: KizilkanMedia3View, value: Map<String, String>? -> view.setHeaders(value) }
      Prop("source") { view: KizilkanMedia3View, value: String? -> view.setSource(value) }
      Prop("paused") { view: KizilkanMedia3View, value: Boolean -> view.setPaused(value) }
      Prop("volume") { view: KizilkanMedia3View, value: Double -> view.setVolume(value) }
      Prop("rate") { view: KizilkanMedia3View, value: Double -> view.setRate(value) }
      Prop("resizeMode") { view: KizilkanMedia3View, value: String -> view.setResizeMode(value) }
      Prop("bufferMs") { view: KizilkanMedia3View, value: Int -> view.setBufferMs(value) }
      AsyncFunction("play") { view: KizilkanMedia3View -> view.play() }
      AsyncFunction("pause") { view: KizilkanMedia3View -> view.pause() }
      AsyncFunction("seekBy") { view: KizilkanMedia3View, seconds: Double -> view.seekBy(seconds) }
      AsyncFunction("seekTo") { view: KizilkanMedia3View, seconds: Double -> view.seekTo(seconds) }
    }
  }
}
