import geohash from 'ngeohash';

// 精度とカバー距離の対応 (おおよそ)
// precision 4: ±20km
// precision 5: ±2.4km
// precision 6: ±610m
// precision 7: ±76m

export const GEOHASH_PRECISION = 6; // 半径2kmをカバーするため

/**
 * 緯度経度からGeoHashを生成
 */
export function encodeGeohash(latitude: number, longitude: number): string {
  return geohash.encode(latitude, longitude, GEOHASH_PRECISION);
}

/**
 * GeoHashから緯度経度を復元
 */
export function decodeGeohash(hash: string): { latitude: number; longitude: number } {
  const { latitude, longitude } = geohash.decode(hash);
  return { latitude, longitude };
}

/**
 * 指定した地点の周辺のGeoHashプレフィックスを取得
 * 半径2km圏内をカバーするため、自身と隣接する8つのセルを返す
 */
export function getNeighborGeohashes(latitude: number, longitude: number): string[] {
  const centerHash = encodeGeohash(latitude, longitude);
  const neighbors = geohash.neighbors(centerHash);
  
  return [
    centerHash,
    ...Object.values(neighbors)
  ];
}

/**
 * 2点間の距離を計算（メートル単位）
 * Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // 地球の半径（メートル）
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * 座標を整数化（精度を保ちつつDB保存用）
 */
export function encodeCoordinate(value: number): number {
  return Math.round(value * 1e7);
}

/**
 * 整数化された座標を元に戻す
 */
export function decodeCoordinate(value: number): number {
  return value / 1e7;
}
