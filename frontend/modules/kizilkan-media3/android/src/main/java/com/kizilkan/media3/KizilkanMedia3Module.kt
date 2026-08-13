package com.kizilkan.media3

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KizilkanMedia3Module : Module() {
  override fun definition() = ModuleDefinition {
    Name("KizilkanMedia3")

    AsyncFunction("openPlaybackActivity") {
      channelsJson: String,
      currentIndex: Int,
      headersJson: String,
      bufferMs: Int,
      resizeMode: String ->
      val activity = appContext.currentActivity
        ?: throw IllegalStateException("KIZILKAN Playback Activity için aktif Android Activity yok")
      val intent = Intent(activity, KizilkanPlaybackActivity::class.java).apply {
        putExtra(KizilkanPlaybackActivity.EXTRA_CHANNELS, channelsJson)
        putExtra(KizilkanPlaybackActivity.EXTRA_INDEX, currentIndex)
        putExtra(KizilkanPlaybackActivity.EXTRA_HEADERS, headersJson)
        putExtra(KizilkanPlaybackActivity.EXTRA_BUFFER_MS, bufferMs)
        putExtra(KizilkanPlaybackActivity.EXTRA_RESIZE_MODE, resizeMode)
      }
      activity.startActivity(intent)
    }

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
