export interface Channel {
  id: string;
  name: string;
  logo?: string | null;
  group?: string | null;
  url: string;
  tvg_id?: string | null;
  tvg_name?: string | null;
  epg_channel_id?: string | null;
  stream_type?: string;
  container_ext?: string | null;
  tv_archive?: number; // 1 if catch-up available
  tv_archive_duration?: number; // days
  stream_id?: number | string; // for catch-up URL builder
}

export interface VodItem {
  id: string;
  stream_id: number | string;
  name: string;
  poster?: string | null;
  rating?: string | number | null;
  rating_5based?: number | null;
  year?: string | number | null;
  group?: string | null;
  url: string;
  container_ext?: string | null;
  added?: string | null;
}

export interface SeriesItem {
  id: string;
  series_id: number | string;
  name: string;
  poster?: string | null;
  plot?: string | null;
  cast?: string | null;
  director?: string | null;
  genre?: string | null;
  release_date?: string | null;
  rating?: string | number | null;
  rating_5based?: number | null;
  group?: string | null;
}

export interface AccountInfo {
  username?: string;
  status?: string;
  exp_date?: string | null;
  is_trial?: string;
  active_cons?: string | number;
  max_connections?: string | number;
  created_at?: string;
  mac?: string;
  phone?: string;
  tariff_plan?: string;
  tariff_expired_date?: string | null;
  /** Sunucunun desteklediği yayın formatları (Xtream standardı). */
  allowed_output_formats?: string[];
  /** Panelin gönderdiği mesaj/duyuru (Xtream standardı). */
  message?: string;
  /** Panelin gönderdiği DİĞER tüm alanlar burada saklanır ve gösterilir.
   *  Bazı paneller APK linki, destek bağlantısı gibi özel alanlar gönderir. */
  extra?: Record<string, any>;
}

/**
 * Kullanıcının kendi girdiği sağlayıcı bilgileri (v5.6.0).
 * Xtream standardında APK linki / Telegram / oynatıcı listesi YOKTUR; bunları
 * sağlayıcı ayrıca bildirir. Kullanıcı buraya kaydeder, elinin altında olur.
 */
export interface ProviderInfo {
  apkUrl?: string;
  telegram?: string;
  whatsapp?: string;
  website?: string;
  /** İzin verilen oynatıcılar (sağlayıcının bildirdiği). */
  allowedPlayers?: string;
  /** Yasaklı oynatıcılar. */
  bannedPlayers?: string;
  /** Duyurular / notlar. */
  notes?: string;
}

/** Xtream server_info yanıtı — sunucu bilgileri (kullanıcı isteği: görünür olsun). */
export interface ServerInfo {
  url?: string;
  port?: string | number;
  https_port?: string | number;
  server_protocol?: string;
  rtmp_port?: string | number;
  timezone?: string;
  timestamp_now?: number;
  time_now?: string;
  version?: string;
  revision?: string | number;
}

export type PlaylistSource = 'm3u_url' | 'm3u_file' | 'xtream' | 'stalker';

export interface Playlist {
  id: string;
  name: string;
  source: PlaylistSource;
  m3uUrl?: string;
  xtreamServer?: string;
  xtreamUsername?: string;
  xtreamPassword?: string;
  stalkerPortal?: string;
  stalkerMac?: string;
  stalkerSerial?: string;
  accountInfo?: AccountInfo | null;
  serverInfo?: ServerInfo | null;
  /** Kullanıcının girdiği sağlayıcı bilgileri (APK, destek, oynatıcı listesi). */
  providerInfo?: ProviderInfo | null;
  channels: Channel[];
  vod?: VodItem[];
  series?: SeriesItem[];
  epgUrl?: string;
  createdAt: string;
}

export interface EPGProgram {
  channel: string;
  start: string;
  stop: string;
  title: string;
  desc?: string;
}

export interface NowNext {
  now: EPGProgram | null;
  next: EPGProgram | null;
}

// --- Profile & Parental ---

export interface Profile {
  id: string;
  name: string;
  color: string;
  hasPin: boolean;
  pin?: string;
  isKids?: boolean;
}

export interface ParentalSettings {
  enabled: boolean;
  pin: string;
  lockedCategories: string[];
}

export interface CatchupProgram {
  title: string;
  start: string;
  stop: string;
  start_timestamp?: string | number;
  stop_timestamp?: string | number;
  has_archive?: number | string;
  epg_id?: string;
  description?: string;
}
