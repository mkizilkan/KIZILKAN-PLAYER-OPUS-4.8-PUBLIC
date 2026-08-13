import { requireNativeModule } from "expo-modules-core";

export { KizilkanMedia3View } from "./KizilkanMedia3View";
export type { KizilkanMedia3Props, KizilkanMedia3Ref } from "./KizilkanMedia3View";

type KizilkanMedia3ModuleApi = {
  openPlaybackActivity(
    channelsJson: string,
    currentIndex: number,
    headersJson: string,
    bufferMs: number,
    resizeMode: "contain" | "cover" | "fill"
  ): Promise<void>;
};

const NativeModule = requireNativeModule<KizilkanMedia3ModuleApi>("KizilkanMedia3");

export function openKizilkanPlaybackActivity(args: {
  channels: Array<{ id?: string; name?: string; url: string }>;
  currentIndex: number;
  headers?: Record<string, string>;
  bufferMs?: number;
  resizeMode?: "contain" | "cover" | "fill";
}): Promise<void> {
  return NativeModule.openPlaybackActivity(
    JSON.stringify(args.channels),
    args.currentIndex,
    JSON.stringify(args.headers ?? {}),
    args.bufferMs ?? 1500,
    args.resizeMode ?? "contain"
  );
}
