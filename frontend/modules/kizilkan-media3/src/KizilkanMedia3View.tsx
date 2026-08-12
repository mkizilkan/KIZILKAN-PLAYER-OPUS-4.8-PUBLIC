import React, { forwardRef } from "react";
import { Platform, type ViewProps } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";

export type KizilkanMedia3Ref = {
  play(): Promise<void>;
  pause(): Promise<void>;
  seekBy(seconds: number): Promise<void>;
  seekTo(seconds: number): Promise<void>;
};

export type KizilkanMedia3Props = ViewProps & {
  source?: string | null;
  headers?: Record<string, string>;
  paused?: boolean;
  volume?: number;
  rate?: number;
  resizeMode?: "contain" | "cover" | "fill";
  bufferMs?: number;
  onFirstFrame?: (event: { nativeEvent: { source?: string } }) => void;
  onStateChange?: (event: { nativeEvent: { state?: string; isPlaying?: boolean } }) => void;
  onError?: (event: { nativeEvent: { message?: string; errorCode?: number } }) => void;
  onVideoSize?: (event: { nativeEvent: { width?: number; height?: number } }) => void;
};

const NativeView = Platform.OS === "android"
  ? requireNativeViewManager<KizilkanMedia3Props>("KizilkanMedia3")
  : null;

export const KizilkanMedia3View = forwardRef<KizilkanMedia3Ref, KizilkanMedia3Props>((props, ref) => {
  if (!NativeView) return null;
  return <NativeView ref={ref as any} {...props} />;
});
KizilkanMedia3View.displayName = "KizilkanMedia3View";
