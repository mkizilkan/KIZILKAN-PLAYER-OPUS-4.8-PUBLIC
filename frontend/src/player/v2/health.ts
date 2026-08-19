/** GPT KIZILKAN PLAYER ELITE v14.2.0 — runtime stall health */

export const STALL_CHECK_INTERVAL_MS = 1500;
export const LIVE_SOFT_STALL_MS = 5500;
export const LIVE_HARD_STALL_MS = 9500;
export const VOD_SOFT_STALL_MS = 9000;
export const VOD_HARD_STALL_MS = 15000;
export const STALL_MIN_ADVANCE_SECONDS = 0.35;
export const PLAYER_UI_TIME_UPDATE_MS = 1000;

export type PlaybackClock = {
  positionSeconds: number;
  lastEventAt: number;
  lastAdvanceAt: number;
};

export function makePlaybackClock(now = Date.now()): PlaybackClock {
  return { positionSeconds: 0, lastEventAt: now, lastAdvanceAt: now };
}

export function notePlaybackPosition(
  prev: PlaybackClock,
  nextSeconds: number,
  now = Date.now(),
  minAdvance = STALL_MIN_ADVANCE_SECONDS,
): PlaybackClock {
  if (!Number.isFinite(nextSeconds) || nextSeconds < 0) return { ...prev, lastEventAt: now };
  const advanced = nextSeconds >= prev.positionSeconds + minAdvance || nextSeconds < prev.positionSeconds - 1;
  return {
    positionSeconds: nextSeconds,
    lastEventAt: now,
    lastAdvanceAt: advanced ? now : prev.lastAdvanceAt,
  };
}
