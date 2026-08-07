/**
 * KIZILKAN PLAYER v9.12.2 — TypeScript resolver bridge for Google Cast.
 *
 * Metro selects cast.native.ts on Android/iOS and cast.web.ts on web.
 * TypeScript's default resolver does not understand React Native platform
 * suffixes, so this base file exposes the same public symbols for typecheck.
 * It is not the runtime implementation on native/web builds.
 */
export { GoogleCast, NativeCastButton } from "./cast.native";
