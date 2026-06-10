// 狼煙情報の型定義
export interface Noroshi {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  geohash: string;
  address: string;
  message: string;
  startAt: string; // ISO 8601
  endAt: string;   // ISO 8601
  createdAt: string;
}

// 狼煙作成リクエスト
export interface CreateNoroshiRequest {
  latitude: number;
  longitude: number;
  address: string;
  message: string;
  startAt: string;
  endAt: string;
}

// 狼煙検索リクエスト
export interface SearchNoroshiRequest {
  latitude: number;
  longitude: number;
  radius?: number; // デフォルト2000m
}

// 狼煙検索レスポンス
export interface SearchNoroshiResponse {
  noroshis: Noroshi[];
}

// Push通知ペイロード
export interface NoroshiNotification {
  type: 'new_noroshi';
  noroshi: Noroshi;
}

// デバイストークン登録
export interface RegisterDeviceRequest {
  userId: string;
  token: string;
  latitude: number;
  longitude: number;
}

// APIレスポンス
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
