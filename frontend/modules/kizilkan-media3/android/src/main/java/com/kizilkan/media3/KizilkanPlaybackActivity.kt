package com.kizilkan.media3

import android.app.Activity
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import org.json.JSONArray
import org.json.JSONObject

/**
 * KIZILKAN PLAYER v9.18.0 Beta — Android TV bağımsız playback penceresi.
 *
 * Bu Activity ReactRootView / ExpoView ağacının DIŞINDADIR. Amaç ilk kanal
 * açılışındaki tema rengi/şerit problemini renderer değiştirmek yerine Android
 * Window seviyesinde izole etmektir.
 */
@OptIn(UnstableApi::class)
class KizilkanPlaybackActivity : Activity() {
  data class Channel(val id: String, val name: String, val url: String)

  private lateinit var playerView: PlayerView
  private var player: ExoPlayer? = null
  private var channels: List<Channel> = emptyList()
  private var currentIndex = 0
  private var headers: Map<String, String> = emptyMap()
  private var bufferMs = 1500
  private var resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    window.statusBarColor = Color.BLACK
    window.navigationBarColor = Color.BLACK
    window.setBackgroundDrawableResource(android.R.color.black)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    window.decorView.setBackgroundColor(Color.BLACK)
    window.decorView.systemUiVisibility =
      View.SYSTEM_UI_FLAG_FULLSCREEN or
      View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
      View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
      View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
      View.SYSTEM_UI_FLAG_LAYOUT_STABLE

    channels = parseChannels(intent.getStringExtra(EXTRA_CHANNELS))
    currentIndex = intent.getIntExtra(EXTRA_INDEX, 0).coerceIn(0, (channels.size - 1).coerceAtLeast(0))
    headers = parseHeaders(intent.getStringExtra(EXTRA_HEADERS))
    bufferMs = intent.getIntExtra(EXTRA_BUFFER_MS, 1500).coerceAtLeast(0)
    resizeMode = parseResizeMode(intent.getStringExtra(EXTRA_RESIZE_MODE))

    playerView = PlayerView(this).apply {
      setBackgroundColor(Color.BLACK)
      setShutterBackgroundColor(Color.BLACK)
      useController = false
      resizeMode = this@KizilkanPlaybackActivity.resizeMode
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
    }

    val root = FrameLayout(this).apply {
      setBackgroundColor(Color.BLACK)
      addView(playerView)
    }
    setContentView(root)

    if (channels.isEmpty()) {
      finish()
      return
    }
    createPlayer()
    playIndex(currentIndex)
  }

  private fun createPlayer() {
    if (player != null) return
    val minBuffer = bufferMs.coerceAtLeast(500)
    val maxBuffer = (minBuffer * 4).coerceAtLeast(5000)
    val loadControl = DefaultLoadControl.Builder()
      .setBufferDurationsMs(
        minBuffer,
        maxBuffer,
        (minBuffer / 2).coerceAtLeast(250),
        minBuffer.coerceAtLeast(500)
      )
      .build()

    val httpFactory = DefaultHttpDataSource.Factory()
      .setAllowCrossProtocolRedirects(true)
      .setDefaultRequestProperties(headers)

    val mediaSourceFactory = DefaultMediaSourceFactory(this)
      .setDataSourceFactory(httpFactory)

    player = ExoPlayer.Builder(this)
      .setLoadControl(loadControl)
      .setMediaSourceFactory(mediaSourceFactory)
      .build()
      .also { p ->
        p.addListener(object : Player.Listener {
          override fun onPlayerError(error: PlaybackException) {
            // Faz-1'de hata Activity'yi çökertmez. Kullanıcı BACK ile RN'e dönebilir.
          }
        })
        playerView.player = p
      }
  }

  private fun playIndex(index: Int) {
    if (channels.isEmpty()) return
    currentIndex = ((index % channels.size) + channels.size) % channels.size
    val channel = channels[currentIndex]
    val p = player ?: return
    p.setMediaItem(MediaItem.Builder().setUri(Uri.parse(channel.url)).build())
    p.prepare()
    p.playWhenReady = true
    p.play()
  }

  private fun zap(delta: Int) {
    if (channels.size < 2) return
    playIndex(currentIndex + delta)
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (event.action == KeyEvent.ACTION_DOWN) {
      when (event.keyCode) {
        KeyEvent.KEYCODE_DPAD_UP,
        KeyEvent.KEYCODE_CHANNEL_UP,
        KeyEvent.KEYCODE_MEDIA_NEXT -> {
          zap(+1)
          return true
        }
        KeyEvent.KEYCODE_DPAD_DOWN,
        KeyEvent.KEYCODE_CHANNEL_DOWN,
        KeyEvent.KEYCODE_MEDIA_PREVIOUS -> {
          zap(-1)
          return true
        }
        KeyEvent.KEYCODE_DPAD_CENTER,
        KeyEvent.KEYCODE_ENTER,
        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
          player?.let { if (it.isPlaying) it.pause() else it.play() }
          return true
        }
        KeyEvent.KEYCODE_MEDIA_PLAY -> {
          player?.play()
          return true
        }
        KeyEvent.KEYCODE_MEDIA_PAUSE -> {
          player?.pause()
          return true
        }
      }
    }
    return super.dispatchKeyEvent(event)
  }

  override fun onStop() {
    super.onStop()
    if (isFinishing) releasePlayer()
  }

  override fun onDestroy() {
    releasePlayer()
    super.onDestroy()
  }

  private fun releasePlayer() {
    playerView.player = null
    player?.release()
    player = null
  }

  private fun parseChannels(raw: String?): List<Channel> {
    if (raw.isNullOrBlank()) return emptyList()
    return try {
      val arr = JSONArray(raw)
      buildList {
        for (i in 0 until arr.length()) {
          val o = arr.optJSONObject(i) ?: continue
          val url = o.optString("url").trim()
          if (url.isEmpty()) continue
          add(Channel(o.optString("id"), o.optString("name"), url))
        }
      }
    } catch (_: Throwable) {
      emptyList()
    }
  }

  private fun parseHeaders(raw: String?): Map<String, String> {
    if (raw.isNullOrBlank()) return emptyMap()
    return try {
      val o = JSONObject(raw)
      buildMap {
        val keys = o.keys()
        while (keys.hasNext()) {
          val key = keys.next()
          val value = o.optString(key)
          if (key.isNotBlank() && value.isNotBlank()) put(key, value)
        }
      }
    } catch (_: Throwable) {
      emptyMap()
    }
  }

  private fun parseResizeMode(value: String?): Int = when (value) {
    "cover" -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
    "fill" -> AspectRatioFrameLayout.RESIZE_MODE_FILL
    else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
  }

  companion object {
    const val EXTRA_CHANNELS = "kizilkan.channels"
    const val EXTRA_INDEX = "kizilkan.index"
    const val EXTRA_HEADERS = "kizilkan.headers"
    const val EXTRA_BUFFER_MS = "kizilkan.bufferMs"
    const val EXTRA_RESIZE_MODE = "kizilkan.resizeMode"
  }
}
