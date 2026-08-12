package com.kizilkan.media3

import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.view.Gravity
import android.widget.FrameLayout
import androidx.media3.common.MediaItem
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

@OptIn(UnstableApi::class)
class KizilkanMedia3View(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onFirstFrame by EventDispatcher()
  private val onStateChange by EventDispatcher()
  private val onError by EventDispatcher()
  private val onVideoSize by EventDispatcher()

  private val playerView = PlayerView(context).apply {
    setBackgroundColor(Color.BLACK)
    useController = false
    setShutterBackgroundColor(Color.BLACK)
    // KIZILKAN TV: surface_type XML attribute yerine doğrudan PlayerView'ın
    // varsayılan native SurfaceView yolu kullanılır. Media3 bu surface'in
    // lifecycle'ını kendisi takip eder.
    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
    layoutParams = FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT,
      Gravity.CENTER
    )
  }

  private var player: ExoPlayer? = null
  private var source: String? = null
  private var requestedPlay = true
  private var headers: Map<String, String> = emptyMap()
  private var requestedVolume = 1f
  private var requestedRate = 1f
  private var bufferMs = 1500

  private val listener = object : Player.Listener {
    override fun onPlaybackStateChanged(playbackState: Int) {
      onStateChange(
        mapOf(
          "state" to when (playbackState) {
            Player.STATE_IDLE -> "idle"
            Player.STATE_BUFFERING -> "buffering"
            Player.STATE_READY -> "ready"
            Player.STATE_ENDED -> "ended"
            else -> "unknown"
          },
          "isPlaying" to (player?.isPlaying == true)
        )
      )
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
      onStateChange(mapOf("state" to if (isPlaying) "playing" else "paused", "isPlaying" to isPlaying))
    }

    override fun onRenderedFirstFrame() {
      onFirstFrame(mapOf("source" to (source ?: "")))
    }

    override fun onPlayerError(error: PlaybackException) {
      onError(mapOf("message" to (error.message ?: "Media3 playback error"), "errorCode" to error.errorCode))
    }

    override fun onVideoSizeChanged(videoSize: VideoSize) {
      onVideoSize(mapOf("width" to videoSize.width, "height" to videoSize.height))
    }
  }

  init {
    setBackgroundColor(Color.BLACK)
    addView(playerView)
  }

  private fun ensurePlayer() {
    if (player != null) return
    val minBuffer = bufferMs.coerceAtLeast(500)
    val maxBuffer = (minBuffer * 4).coerceAtLeast(5000)
    val loadControl = DefaultLoadControl.Builder()
      .setBufferDurationsMs(minBuffer, maxBuffer, (minBuffer / 2).coerceAtLeast(250), minBuffer.coerceAtLeast(500))
      .build()
    val httpFactory = DefaultHttpDataSource.Factory()
      .setAllowCrossProtocolRedirects(true)
      .setDefaultRequestProperties(headers)
    val mediaSourceFactory = DefaultMediaSourceFactory(context)
      .setDataSourceFactory(httpFactory)
    player = ExoPlayer.Builder(context)
      .setMediaSourceFactory(mediaSourceFactory)
      .setLoadControl(loadControl)
      .build()
      .also {
        it.addListener(listener)
        it.volume = requestedVolume
        it.setPlaybackSpeed(requestedRate)
        playerView.player = it
      }
  }

  fun setSource(value: String?) {
    val normalized = value?.trim()?.takeIf { it.isNotEmpty() }
    if (normalized == source) return
    source = normalized
    if (normalized == null) {
      player?.stop()
      player?.clearMediaItems()
      return
    }
    ensurePlayer()
    val itemBuilder = MediaItem.Builder().setUri(Uri.parse(normalized))
    // HTTP headers MediaItem seviyesinde tüm Media3 sürümlerinde kararlı API
    // değildir. Header ihtiyacı olan kanallar mevcut VLC fallback yolunu korur.
    val item = itemBuilder.build()
    player?.setMediaItem(item)
    player?.prepare()
    player?.playWhenReady = requestedPlay
  }

  fun setHeaders(value: Map<String, String>?) {
    val next = value ?: emptyMap()
    if (next == headers) return
    headers = next
    // Header prop source'tan önce/sonra gelebilir. Player henüz kurulmadıysa
    // ensurePlayer yeni değerleri alır; kurulmuşsa mevcut kaynağı güvenli biçimde
    // yeniden kurarak UA/Referer'ın gerçekten datasource'a geçmesini sağlarız.
    if (player != null && source != null) {
      val current = source
      releasePlayer()
      source = null
      setSource(current)
    }
  }
  fun setPaused(paused: Boolean) {
    requestedPlay = !paused
    player?.playWhenReady = requestedPlay
    if (requestedPlay) player?.play() else player?.pause()
  }
  fun setVolume(value: Double) {
    requestedVolume = value.toFloat().coerceIn(0f, 1f)
    player?.volume = requestedVolume
  }
  fun setRate(value: Double) {
    requestedRate = value.toFloat().coerceIn(0.25f, 4f)
    player?.setPlaybackSpeed(requestedRate)
  }
  fun setResizeMode(value: String) {
    playerView.resizeMode = when (value) {
      "cover" -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
      "fill" -> AspectRatioFrameLayout.RESIZE_MODE_FILL
      else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
    }
  }
  fun setBufferMs(value: Int) { bufferMs = value.coerceAtLeast(0) }
  fun play() { requestedPlay = true; player?.play() }
  fun pause() { requestedPlay = false; player?.pause() }
  fun seekBy(seconds: Double) {
    val p = player ?: return
    p.seekTo((p.currentPosition + (seconds * 1000.0).toLong()).coerceAtLeast(0L))
  }
  fun seekTo(seconds: Double) { player?.seekTo((seconds * 1000.0).toLong().coerceAtLeast(0L)) }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    releasePlayer()
  }

  fun releasePlayer() {
    playerView.player = null
    player?.removeListener(listener)
    player?.release()
    player = null
  }
}
