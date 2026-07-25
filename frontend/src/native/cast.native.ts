// Native Google Cast binding — resolved on iOS/Android by Metro
export const GoogleCast: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-google-cast");
    return mod.default || mod;
  } catch {
    return null;
  }
})();
