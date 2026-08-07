/**
 * KIZILKAN PLAYER v9.12.1 — TypeScript çözümleme köprüsü.
 *
 * Metro, Android/iOS'ta `vlc.native.ts`, web'de `vlc.web.ts` seçer. TypeScript
 * ise platform uzantılarını Metro gibi otomatik çözmediğinden `@/src/native/vlc`
 * importu typecheck aşamasında bulunamıyordu. Bu dosya yalnız TS/base resolver
 * için aynı native public API'yi yeniden dışa aktarır; runtime motor seçimini
 * değiştirmez.
 */
export { VlcPlayerView, DEFAULT_VLC_OPTIONS, VLCPlayer } from "./vlc.native";
export type { VlcPlayerHandle, VlcTracks, VlcTrack } from "./vlc.native";
