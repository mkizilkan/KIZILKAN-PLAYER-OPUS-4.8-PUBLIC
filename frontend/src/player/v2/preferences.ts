export const PLAYER_BUFFER_KEY = "kizilkan.player.buffer";
export const PLAYER_BUFFER_V2_MIGRATION_KEY = "kizilkan.player.v2.bufferMigrated";
export const PLAYER_BUFFER_OPTIONS = [0, 300, 450, 1000, 1500, 2500, 4000, 6000] as const;

export function bufferLabel(ms: number): string {
  if (ms === 0) return "En düşük — en az gecikme (takılma riski)";
  if (ms === 300) return "0.3 saniye — ultra hızlı";
  if (ms === 450) return "0.45 saniye — Player V2 canlı varsayılanı";
  const seconds = (ms / 1000).toFixed(ms % 1000 ? 1 : 0);
  return `${seconds} saniye${ms >= 4000 ? " — zayıf bağlantı" : ms === 1500 ? " — stabil" : ""}`;
}
