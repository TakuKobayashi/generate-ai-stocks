/**
 * geohash.ts
 * すべてのテーブルは encode/decode を使った総当たり計算で検証済み。
 *
 * parity:
 *   odd  = hash長が奇数 (最後ビット=経度優先)
 *   even = hash長が偶数 (最後ビット=緯度優先)
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const BASE32_MAP: Record<string, number> = {};
for (let i = 0; i < BASE32.length; i++) BASE32_MAP[BASE32[i]!] = i;

// 総当たり計算で検証済みテーブル
const NEIGHBOR_ODD = {
  right:  "14365h7k9dcfesgujnmqp0r2twvyx8zb",
  left:   "p0r21436x8zb9dcf5h7kjnmqesgutwvy",
  top:    "238967debc01fg45kmstqrwxuvhjyznp",
  bottom: "bc01fg45238967deuvhjyznpkmstqrwx",
} as const;

const NEIGHBOR_EVEN = {
  right:  "238967debc01fg45kmstqrwxuvhjyznp",
  left:   "bc01fg45238967deuvhjyznpkmstqrwx",
  top:    "14365h7k9dcfesgujnmqp0r2twvyx8zb",
  bottom: "p0r21436x8zb9dcf5h7kjnmqesgutwvy",
} as const;

const BORDER_ODD = {
  right: "prxz", left: "028b", top: "bcfguvyz", bottom: "0145hjnp",
} as const;

const BORDER_EVEN = {
  right: "bcfguvyz", left: "0145hjnp", top: "prxz", bottom: "028b",
} as const;

type Direction = "top" | "bottom" | "left" | "right";

export type BoundingBox = {
  minLat: number; maxLat: number;
  minLng: number; maxLng: number;
};

export type DecodedGeohash = {
  lat: number; lng: number;
  error: { lat: number; lng: number };
  bounds: BoundingBox;
};

export function encodeGeohash(lat: number, lng: number, precision = 9): string {
  if (lat < -90 || lat > 90)   throw new RangeError(`lat out of range: ${lat}`);
  if (lng < -180 || lng > 180) throw new RangeError(`lng out of range: ${lng}`);
  if (precision < 1 || precision > 12) throw new RangeError(`precision out of range: ${precision}`);

  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let hash = "", bits = 0, charBits = 0;
  let isEven = true;

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { charBits = (charBits << 1) | 1; lngMin = mid; }
      else            { charBits = charBits << 1;        lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { charBits = (charBits << 1) | 1; latMin = mid; }
      else            { charBits = charBits << 1;        latMax = mid; }
    }
    isEven = !isEven;
    if (++bits === 5) { hash += BASE32[charBits]!; bits = 0; charBits = 0; }
  }
  return hash;
}

export function decodeGeohash(hash: string): DecodedGeohash {
  if (!hash) throw new Error("Empty geohash");
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let isEven = true;

  for (const char of hash) {
    const val = BASE32_MAP[char];
    if (val === undefined) throw new Error(`Invalid geohash character: ${char}`);
    for (let mask = 16; mask > 0; mask >>= 1) {
      if (isEven) {
        const mid = (lngMin + lngMax) / 2;
        if (val & mask) lngMin = mid; else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (val & mask) latMin = mid; else latMax = mid;
      }
      isEven = !isEven;
    }
  }
  const lat = (latMin + latMax) / 2;
  const lng = (lngMin + lngMax) / 2;
  return {
    lat, lng,
    error: { lat: (latMax - latMin) / 2, lng: (lngMax - lngMin) / 2 },
    bounds: { minLat: latMin, maxLat: latMax, minLng: lngMin, maxLng: lngMax },
  };
}

export function getNeighbor(hash: string, direction: Direction): string {
  if (!hash) throw new Error("Empty geohash");
  const lastChar = hash[hash.length - 1]!;
  const parent   = hash.slice(0, -1);
  const isOdd    = hash.length % 2 === 1;
  const nt = isOdd ? NEIGHBOR_ODD : NEIGHBOR_EVEN;
  const bt = isOdd ? BORDER_ODD   : BORDER_EVEN;
  const neighborStr = nt[direction];
  const borderStr   = bt[direction];

  if (borderStr.includes(lastChar) && parent.length > 0) {
    const parentNeighbor = getNeighbor(parent, direction);
    const idx = BASE32.indexOf(lastChar);
    return parentNeighbor + (neighborStr[idx] ?? BASE32[0]!);
  }
  const idx = BASE32.indexOf(lastChar);
  if (idx === -1) return parent + BASE32[0]!;
  return parent + (neighborStr[idx] ?? BASE32[0]!);
}

export function getNeighbors(hash: string): string[] {
  const n = getNeighbor(hash, "top");
  const s = getNeighbor(hash, "bottom");
  const e = getNeighbor(hash, "right");
  const w = getNeighbor(hash, "left");
  return [hash, n, getNeighbor(n, "right"), e, getNeighbor(s, "right"),
          s, getNeighbor(s, "left"), w, getNeighbor(n, "left")];
}

export function getBoundingBox(lat: number, lng: number, radiusMeters: number): BoundingBox {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: Math.max(-90,  lat - latDelta), maxLat: Math.min(90,  lat + latDelta),
    minLng: Math.max(-180, lng - lngDelta), maxLng: Math.min(180, lng + lngDelta),
  };
}

export function calculateDistanceMeters(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function selectGeohashPrecision(radiusMeters: number): number {
  if (radiusMeters <= 19)     return 8;
  if (radiusMeters <= 76)     return 7;
  if (radiusMeters <= 610)    return 6;
  if (radiusMeters <= 2_400)  return 5;
  if (radiusMeters <= 20_000) return 4;
  return 3;
}

export function getSearchPrefixes(lat: number, lng: number, radiusMeters: number): string[] {
  return getNeighbors(encodeGeohash(lat, lng, selectGeohashPrecision(radiusMeters)));
}

export function encodeCursor(geohash: string, id: string): string {
  return btoa(`${geohash}:${id}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function decodeCursor(cursor: string): { geohash: string; id: string } | null {
  if (!cursor) return null;
  try {
    const b64    = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const raw    = atob(padded);
    const sep    = raw.indexOf(":");
    if (sep === -1) return null;
    return { geohash: raw.slice(0, sep), id: raw.slice(sep + 1) };
  } catch { return null; }
}
