import { describe, it, expect } from "vitest";
import {
  encodeGeohash, decodeGeohash, getNeighbors, getNeighbor,
  getBoundingBox, calculateDistanceMeters, selectGeohashPrecision,
  getSearchPrefixes, encodeCursor, decodeCursor,
} from "../utils/geohash";

describe("encodeGeohash", () => {
  it("東京駅 precision=9 はxn7で始まる", () => {
    const h = encodeGeohash(35.6812, 139.7671, 9);
    expect(h.length).toBe(9);
    expect(h.startsWith("xn7")).toBe(true);
  });
  it("SF (負の経度) precision=6 はxn7で始まる", () => {
    const h = encodeGeohash(37.7749, -122.4194, 6);
    expect(h.length).toBe(6);
    expect(h.startsWith("9q")).toBe(true);
  });
  it("精度1〜12 全て正しい長さ", () => {
    for (let p = 1; p <= 12; p++) expect(encodeGeohash(35.0, 135.0, p).length).toBe(p);
  });
  it("範囲外の緯度でエラー", () => {
    expect(() => encodeGeohash(91, 0)).toThrow(RangeError);
    expect(() => encodeGeohash(-91, 0)).toThrow(RangeError);
  });
  it("範囲外の経度でエラー", () => {
    expect(() => encodeGeohash(0, 181)).toThrow(RangeError);
    expect(() => encodeGeohash(0, -181)).toThrow(RangeError);
  });
  it("精度範囲外でエラー", () => {
    expect(() => encodeGeohash(0, 0, 0)).toThrow(RangeError);
    expect(() => encodeGeohash(0, 0, 13)).toThrow(RangeError);
  });
  it("同一座標は同一ハッシュ", () => {
    expect(encodeGeohash(35.6812, 139.7671, 9)).toBe(encodeGeohash(35.6812, 139.7671, 9));
  });
});

describe("decodeGeohash", () => {
  it("encode→decode の往復精度 ±0.00003度", () => {
    const cases: [number, number][] = [[35.6812,139.7671],[37.7749,-122.4194],[51.5074,-0.1278],[-33.8688,151.2093],[0,0]];
    for (const [lat, lng] of cases) {
      const { lat: dLat, lng: dLng } = decodeGeohash(encodeGeohash(lat, lng, 9));
      expect(Math.abs(dLat - lat)).toBeLessThan(0.00003);
      expect(Math.abs(dLng - lng)).toBeLessThan(0.00003);
    }
  });
  it("bounds が lat/lng を含む", () => {
    const { lat, lng, bounds } = decodeGeohash("xn77h8g");
    expect(lat).toBeGreaterThanOrEqual(bounds.minLat);
    expect(lat).toBeLessThanOrEqual(bounds.maxLat);
    expect(lng).toBeGreaterThanOrEqual(bounds.minLng);
    expect(lng).toBeLessThanOrEqual(bounds.maxLng);
  });
  it("不正文字でエラー", () => expect(() => decodeGeohash("xn7!")).toThrow(/Invalid/));
  it("空文字列でエラー", () => expect(() => decodeGeohash("")).toThrow(/Empty/));
});

describe("getNeighbor 往復整合性", () => {
  const hashes = ["xn77h8g", "xn77h8", "xn77", "bc01fg45", "p0r2"];
  const opp = { top: "bottom", bottom: "top", left: "right", right: "left" } as const;
  for (const h of hashes) {
    for (const dir of ["top","bottom","left","right"] as const) {
      it(`${h} ${dir}→${opp[dir]} 往復`, () => {
        expect(getNeighbor(getNeighbor(h, dir), opp[dir])).toBe(h);
      });
    }
  }
  it("空文字列でエラー", () => expect(() => getNeighbor("", "top")).toThrow(/Empty/));
});

describe("getNeighbors", () => {
  it("9セルを返す", () => expect(getNeighbors("xn77h8g").length).toBe(9));
  it("全てユニーク", () => expect(new Set(getNeighbors("xn77h8g")).size).toBe(9));
  it("中心セルを含む", () => expect(getNeighbors("xn77h8g")).toContain("xn77h8g"));
  it("全セルが同じ精度", () => { for (const c of getNeighbors("xn77h8g")) expect(c.length).toBe(7); });
  it("precision=1 でも正常", () => expect(getNeighbors("x").length).toBe(9));
});

describe("getBoundingBox", () => {
  it("半径500mの範囲が妥当", () => {
    const bb = getBoundingBox(35.68, 139.76, 500);
    expect(bb.maxLat - bb.minLat).toBeGreaterThan(0.008);
    expect(bb.maxLat - bb.minLat).toBeLessThan(0.010);
  });
  it("大きな半径でも境界を超えない", () => {
    const bb = getBoundingBox(89, 0, 500_000);
    expect(bb.maxLat).toBeLessThanOrEqual(90);
    expect(bb.minLat).toBeGreaterThanOrEqual(-90);
  });
});

describe("calculateDistanceMeters", () => {
  it("同地点は0m", () => expect(calculateDistanceMeters(35.68, 139.76, 35.68, 139.76)).toBe(0));
  it("東京〜大阪 396〜404km", () => {
    const d = calculateDistanceMeters(35.6812, 139.7671, 34.7024, 135.4959);
    expect(d).toBeGreaterThan(396_000);
    expect(d).toBeLessThan(404_000);
  });
  it("近距離精度: 真北100m ±10m", () => {
    const d = calculateDistanceMeters(35.6812, 139.7671, 35.6821, 139.7671);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });
  it("対称性 A→B = B→A", () => {
    const d1 = calculateDistanceMeters(35.68, 139.76, 34.70, 135.50);
    const d2 = calculateDistanceMeters(34.70, 135.50, 35.68, 139.76);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });
});

describe("selectGeohashPrecision", () => {
  const cases: [number, number][] = [[10,8],[19,8],[20,7],[76,7],[77,6],[610,6],[611,5],[2400,5],[2401,4],[20000,4],[20001,3],[50000,3]];
  for (const [r, p] of cases) it(`radius=${r}m → precision ${p}`, () => expect(selectGeohashPrecision(r)).toBe(p));
});

describe("getSearchPrefixes", () => {
  it("9セルを返す", () => expect(getSearchPrefixes(35.68, 139.76, 500).length).toBe(9));
  it("全てユニーク", () => expect(new Set(getSearchPrefixes(35.68, 139.76, 500)).size).toBe(9));
  it("中心を含む", () => {
    const lat=35.6812, lng=139.7671, r=500;
    const center = encodeGeohash(lat, lng, selectGeohashPrecision(r));
    expect(getSearchPrefixes(lat, lng, r)).toContain(center);
  });
  it("radius=100m → precision=6 → 各セルが6文字", () => {
    for (const c of getSearchPrefixes(35.68, 139.76, 100)) expect(c.length).toBe(6);
  });
  it("経度179.9でも9セル", () => expect(getSearchPrefixes(0, 179.9, 1000).length).toBe(9));
  it("北極付近でも9セル", () => expect(getSearchPrefixes(89.9, 0, 1000).length).toBe(9));
});

describe("cursor encode/decode", () => {
  it("往復一致", () => { const h="xn77h8g",id="abc123"; expect(decodeCursor(encodeCursor(h,id))).toEqual({geohash:h,id}); });
  it("idにコロン含む", () => { const h="abc",id="a:b:c"; expect(decodeCursor(encodeCursor(h,id))).toEqual({geohash:h,id}); });
  it("空文字はnull", () => expect(decodeCursor("")).toBeNull());
  it("不正なbase64はnull", () => expect(decodeCursor("!!!")).toBeNull());
  it("コロンなしはnull", () => expect(decodeCursor(btoa("nocolon").replace(/=/g,""))).toBeNull());
});

describe("近傍検索シナリオ統合", () => {
  it("半径500m外の地点がフィルタされる", () => {
    const uLat=35.6812, uLng=139.7671, r=500;
    const pts=[{id:"A",lat:35.6820,lng:139.7680},{id:"B",lat:35.6850,lng:139.7700},{id:"C",lat:35.6595,lng:139.7004},{id:"D",lat:35.6800,lng:139.7710}];
    const inRange=pts.filter(p=>calculateDistanceMeters(uLat,uLng,p.lat,p.lng)<=r).map(p=>p.id);
    expect(inRange).toContain("A");
    expect(inRange).toContain("B");
    expect(inRange).not.toContain("C");
    expect(inRange).toContain("D");
  });
  it("9セルprefixが半径内の全地点をカバー", () => {
    const uLat=35.6812, uLng=139.7671, r=500;
    const prefixes=getSearchPrefixes(uLat,uLng,r);
    const prec=selectGeohashPrecision(r);
    for (const p of [{lat:35.6820,lng:139.7680},{lat:35.6800,lng:139.7660},{lat:35.6835,lng:139.7671},{lat:35.6812,lng:139.7720}]) {
      expect(calculateDistanceMeters(uLat,uLng,p.lat,p.lng)).toBeLessThanOrEqual(r);
      expect(prefixes).toContain(encodeGeohash(p.lat,p.lng,prec));
    }
  });
  it("精度は半径が小さいほど大きい", () => {
    expect(selectGeohashPrecision(10)).toBeGreaterThan(selectGeohashPrecision(100));
    expect(selectGeohashPrecision(100)).toBeGreaterThan(selectGeohashPrecision(1000));
  });
});
