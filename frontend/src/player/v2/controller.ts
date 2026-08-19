import type { EngineProfile, PlaybackPhase, ClassifiedPlaybackError } from "./types";

export const LIVE_FAST_BUFFER_MS = 450;
export const FIRST_FRAME_TIMEOUT_LIVE_MS = 1800;
export const FIRST_FRAME_TIMEOUT_VOD_MS = 2600;
export const VLC_VIDEO_HEALTH_TIMEOUT_LIVE_MS = 3000;
export const VLC_VIDEO_HEALTH_TIMEOUT_VOD_MS = 4500;

export function defaultProfile(isTv: boolean): EngineProfile {
  return { engine: "media3", surface: "surfaceView" };
}

export function alternateMedia3Surface(profile: EngineProfile): EngineProfile | null {
  if (profile.engine !== "media3") return null;
  return { engine: "media3", surface: profile.surface === "surfaceView" ? "textureView" : "surfaceView" };
}

export function fallbackFromError(
  profile: EngineProfile,
  err: ClassifiedPlaybackError,
): { next: EngineProfile | null; phase: PlaybackPhase } {
  if (profile.engine === "media3") {
    if (err.trySurfaceRecovery) {
      return { next: alternateMedia3Surface(profile), phase: "recover_surface" };
    }
    if (err.immediateFallback || ["unsupported_codec","extractor","decoder","source"].includes(err.kind)) {
      return { next: { engine: "vlc", decoder: "hw" }, phase: "switch_engine" };
    }
    if (err.retryNetwork) {
      // HTTP/transport farkını bir kez libVLC ile doğrula; Surface/codec zincirine girme.
      return { next: { engine: "vlc", decoder: "hw" }, phase: "network_recovery" };
    }
    return { next: { engine: "vlc", decoder: "hw" }, phase: "switch_engine" };
  }
  if (profile.engine === "vlc" && profile.decoder === "hw") {
    return { next: { engine: "vlc", decoder: "sw" }, phase: "switch_engine" };
  }
  return { next: null, phase: "final_error" };
}
