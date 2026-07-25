// Native VLC binding — resolved on iOS/Android by Metro
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const VLCPlayer: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-vlc-media-player");
    return mod.VLCPlayer || null;
  } catch {
    return null;
  }
})();
