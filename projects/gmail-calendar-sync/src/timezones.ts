/**
 * タイムゾーン解決。
 * LLM には「メールに書いてある文字列」(例: "現地時間", "バンコク", "NRT", "GMT+7") をそのまま抜き出させ、
 * IANA タイムゾーンへの変換はここで決定的に行う (小さいモデルに地理知識・時差計算をさせない)。
 */
import { IANAZone } from "luxon";

export interface TimezoneMatch {
  zone: string;
  source: "offset" | "iana" | "abbr" | "name";
  matched: string;
}

/** 都市・国・空港名 → IANA (日本語 / 英語 / IATA コード) */
const NAME_TO_ZONE: Record<string, string> = {
  // --- 日本 ---
  日本時間: "Asia/Tokyo", 日本: "Asia/Tokyo", 東京: "Asia/Tokyo", 成田: "Asia/Tokyo", 羽田: "Asia/Tokyo",
  大阪: "Asia/Tokyo", 関西: "Asia/Tokyo", 伊丹: "Asia/Tokyo", 京都: "Asia/Tokyo", 名古屋: "Asia/Tokyo",
  中部: "Asia/Tokyo", 札幌: "Asia/Tokyo", 新千歳: "Asia/Tokyo", 福岡: "Asia/Tokyo", 那覇: "Asia/Tokyo",
  沖縄: "Asia/Tokyo", 仙台: "Asia/Tokyo", 広島: "Asia/Tokyo", 神戸: "Asia/Tokyo", 横浜: "Asia/Tokyo",
  Japan: "Asia/Tokyo", Tokyo: "Asia/Tokyo", Osaka: "Asia/Tokyo", Kyoto: "Asia/Tokyo", Sapporo: "Asia/Tokyo",
  Fukuoka: "Asia/Tokyo", Okinawa: "Asia/Tokyo", Narita: "Asia/Tokyo", Haneda: "Asia/Tokyo", Nagoya: "Asia/Tokyo",
  NRT: "Asia/Tokyo", HND: "Asia/Tokyo", KIX: "Asia/Tokyo", ITM: "Asia/Tokyo", NGO: "Asia/Tokyo",
  CTS: "Asia/Tokyo", FUK: "Asia/Tokyo", OKA: "Asia/Tokyo", SDJ: "Asia/Tokyo", HIJ: "Asia/Tokyo", UKB: "Asia/Tokyo",
  // --- 東アジア ---
  韓国: "Asia/Seoul", ソウル: "Asia/Seoul", 仁川: "Asia/Seoul", 金浦: "Asia/Seoul", 釜山: "Asia/Seoul",
  Korea: "Asia/Seoul", Seoul: "Asia/Seoul", Incheon: "Asia/Seoul", Busan: "Asia/Seoul",
  ICN: "Asia/Seoul", GMP: "Asia/Seoul", PUS: "Asia/Seoul",
  台湾: "Asia/Taipei", 台北: "Asia/Taipei", 桃園: "Asia/Taipei", 高雄: "Asia/Taipei",
  Taiwan: "Asia/Taipei", Taipei: "Asia/Taipei", Taoyuan: "Asia/Taipei", Kaohsiung: "Asia/Taipei",
  TPE: "Asia/Taipei", TSA: "Asia/Taipei", KHH: "Asia/Taipei",
  上海: "Asia/Shanghai", 北京: "Asia/Shanghai", 広州: "Asia/Shanghai",
  China: "Asia/Shanghai", Shanghai: "Asia/Shanghai", Beijing: "Asia/Shanghai",
  PVG: "Asia/Shanghai", PEK: "Asia/Shanghai", PKX: "Asia/Shanghai",
  香港: "Asia/Hong_Kong", "Hong Kong": "Asia/Hong_Kong", HKG: "Asia/Hong_Kong",
  マカオ: "Asia/Macau", Macau: "Asia/Macau",
  // --- 東南アジア ---
  タイ: "Asia/Bangkok", バンコク: "Asia/Bangkok", プーケット: "Asia/Bangkok", チェンマイ: "Asia/Bangkok",
  Thailand: "Asia/Bangkok", Bangkok: "Asia/Bangkok", Phuket: "Asia/Bangkok", "Chiang Mai": "Asia/Bangkok",
  BKK: "Asia/Bangkok", DMK: "Asia/Bangkok",
  シンガポール: "Asia/Singapore", Singapore: "Asia/Singapore", SIN: "Asia/Singapore",
  マレーシア: "Asia/Kuala_Lumpur", クアラルンプール: "Asia/Kuala_Lumpur", "Kuala Lumpur": "Asia/Kuala_Lumpur", KUL: "Asia/Kuala_Lumpur",
  ベトナム: "Asia/Ho_Chi_Minh", ホーチミン: "Asia/Ho_Chi_Minh", ハノイ: "Asia/Ho_Chi_Minh", ダナン: "Asia/Ho_Chi_Minh",
  Vietnam: "Asia/Ho_Chi_Minh", "Ho Chi Minh": "Asia/Ho_Chi_Minh", Hanoi: "Asia/Ho_Chi_Minh", "Da Nang": "Asia/Ho_Chi_Minh",
  SGN: "Asia/Ho_Chi_Minh", HAN: "Asia/Ho_Chi_Minh", DAD: "Asia/Ho_Chi_Minh",
  フィリピン: "Asia/Manila", マニラ: "Asia/Manila", セブ: "Asia/Manila", Philippines: "Asia/Manila", Manila: "Asia/Manila",
  Cebu: "Asia/Manila", MNL: "Asia/Manila", CEB: "Asia/Manila",
  バリ: "Asia/Makassar", デンパサール: "Asia/Makassar", Bali: "Asia/Makassar", Denpasar: "Asia/Makassar", DPS: "Asia/Makassar",
  ジャカルタ: "Asia/Jakarta", Jakarta: "Asia/Jakarta", CGK: "Asia/Jakarta",
  // --- 南アジア・中東 ---
  インド: "Asia/Kolkata", デリー: "Asia/Kolkata", ムンバイ: "Asia/Kolkata", India: "Asia/Kolkata", Delhi: "Asia/Kolkata",
  Mumbai: "Asia/Kolkata", DEL: "Asia/Kolkata", BOM: "Asia/Kolkata",
  ドバイ: "Asia/Dubai", Dubai: "Asia/Dubai", DXB: "Asia/Dubai", ドーハ: "Asia/Qatar", Doha: "Asia/Qatar", DOH: "Asia/Qatar",
  イスタンブール: "Europe/Istanbul", Istanbul: "Europe/Istanbul",
  // --- オセアニア・太平洋 ---
  ハワイ: "Pacific/Honolulu", ホノルル: "Pacific/Honolulu", Hawaii: "Pacific/Honolulu", Honolulu: "Pacific/Honolulu", HNL: "Pacific/Honolulu",
  グアム: "Pacific/Guam", Guam: "Pacific/Guam", GUM: "Pacific/Guam",
  シドニー: "Australia/Sydney", Sydney: "Australia/Sydney", SYD: "Australia/Sydney",
  メルボルン: "Australia/Melbourne", Melbourne: "Australia/Melbourne", MEL: "Australia/Melbourne",
  ケアンズ: "Australia/Brisbane", ブリスベン: "Australia/Brisbane", Cairns: "Australia/Brisbane", Brisbane: "Australia/Brisbane",
  CNS: "Australia/Brisbane", BNE: "Australia/Brisbane",
  オークランド: "Pacific/Auckland", Auckland: "Pacific/Auckland", AKL: "Pacific/Auckland",
  // --- 北米 ---
  ロサンゼルス: "America/Los_Angeles", サンフランシスコ: "America/Los_Angeles", シアトル: "America/Los_Angeles",
  ラスベガス: "America/Los_Angeles", "Los Angeles": "America/Los_Angeles", "San Francisco": "America/Los_Angeles",
  Seattle: "America/Los_Angeles", "Las Vegas": "America/Los_Angeles", LAX: "America/Los_Angeles",
  SFO: "America/Los_Angeles", SEA: "America/Los_Angeles", LAS: "America/Los_Angeles",
  バンクーバー: "America/Vancouver", Vancouver: "America/Vancouver", YVR: "America/Vancouver",
  ニューヨーク: "America/New_York", ボストン: "America/New_York", ワシントン: "America/New_York", トロント: "America/Toronto",
  "New York": "America/New_York", Boston: "America/New_York", Toronto: "America/Toronto",
  JFK: "America/New_York", EWR: "America/New_York", BOS: "America/New_York", YYZ: "America/Toronto",
  シカゴ: "America/Chicago", ダラス: "America/Chicago", Chicago: "America/Chicago", Dallas: "America/Chicago",
  ORD: "America/Chicago", DFW: "America/Chicago",
  // --- ヨーロッパ ---
  イギリス: "Europe/London", ロンドン: "Europe/London", London: "Europe/London", LHR: "Europe/London", LGW: "Europe/London",
  フランス: "Europe/Paris", パリ: "Europe/Paris", France: "Europe/Paris", Paris: "Europe/Paris", CDG: "Europe/Paris",
  ドイツ: "Europe/Berlin", ベルリン: "Europe/Berlin", ミュンヘン: "Europe/Berlin", フランクフルト: "Europe/Berlin",
  Germany: "Europe/Berlin", Berlin: "Europe/Berlin", Munich: "Europe/Berlin", Frankfurt: "Europe/Berlin",
  FRA: "Europe/Berlin", MUC: "Europe/Berlin",
  オーストリア: "Europe/Vienna", ウィーン: "Europe/Vienna", Austria: "Europe/Vienna", Vienna: "Europe/Vienna", Wien: "Europe/Vienna", VIE: "Europe/Vienna",
  イタリア: "Europe/Rome", ローマ: "Europe/Rome", ミラノ: "Europe/Rome", ヴェネツィア: "Europe/Rome", フィレンツェ: "Europe/Rome",
  Italy: "Europe/Rome", Rome: "Europe/Rome", Milan: "Europe/Rome", Venice: "Europe/Rome", Florence: "Europe/Rome",
  FCO: "Europe/Rome", MXP: "Europe/Rome",
  スペイン: "Europe/Madrid", マドリード: "Europe/Madrid", バルセロナ: "Europe/Madrid",
  Spain: "Europe/Madrid", Madrid: "Europe/Madrid", Barcelona: "Europe/Madrid", MAD: "Europe/Madrid", BCN: "Europe/Madrid",
  オランダ: "Europe/Amsterdam", アムステルダム: "Europe/Amsterdam", Amsterdam: "Europe/Amsterdam", AMS: "Europe/Amsterdam",
  スイス: "Europe/Zurich", チューリッヒ: "Europe/Zurich", Zurich: "Europe/Zurich", ZRH: "Europe/Zurich",
  チェコ: "Europe/Prague", プラハ: "Europe/Prague", Prague: "Europe/Prague", PRG: "Europe/Prague",
  ヘルシンキ: "Europe/Helsinki", フィンランド: "Europe/Helsinki", Helsinki: "Europe/Helsinki", HEL: "Europe/Helsinki",
  ポルトガル: "Europe/Lisbon", リスボン: "Europe/Lisbon", Lisbon: "Europe/Lisbon", LIS: "Europe/Lisbon",
};

/** タイムゾーン略称 (曖昧な CST / IST などは意図的に除外) */
const ABBR_TO_ZONE: Record<string, string> = {
  JST: "Asia/Tokyo",
  KST: "Asia/Seoul",
  SGT: "Asia/Singapore",
  HKT: "Asia/Hong_Kong",
  ICT: "Asia/Bangkok",
  WIB: "Asia/Jakarta",
  WITA: "Asia/Makassar",
  HST: "Pacific/Honolulu",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  MST: "America/Denver",
  MDT: "America/Denver",
  EST: "America/New_York",
  EDT: "America/New_York",
  AEST: "Australia/Sydney",
  AEDT: "Australia/Sydney",
  NZST: "Pacific/Auckland",
  NZDT: "Pacific/Auckland",
  BST: "Europe/London",
  CET: "Europe/Berlin",
  CEST: "Europe/Berlin",
  UTC: "UTC",
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 正規表現を一度だけ組み立てる */
interface Matcher {
  key: string;
  zone: string;
  re: RegExp;
}
const NAME_MATCHERS: Matcher[] = Object.entries(NAME_TO_ZONE).map(([key, zone]) => {
  const isIata = /^[A-Z]{3}$/.test(key);
  const isLatin = /^[A-Za-z .]+$/.test(key);
  const isKatakana = /^[ァ-ヶー]+$/.test(key);
  // IATA コードは大文字・単語境界必須 (誤検出防止)。英語名は大小無視・単語境界。
  // カタカナ地名は前後がカタカナでないこと (「タイ」が「タイム」に、「セブ」が「セブン」にマッチしないように)。
  // 漢字地名は部分一致。
  const re = isIata
    ? new RegExp(`(?<![A-Za-z])${key}(?![A-Za-z])`)
    : isLatin
      ? new RegExp(`(?<![A-Za-z])${escapeRe(key)}(?![A-Za-z])`, "i")
      : isKatakana
        ? new RegExp(`(?<![ァ-ヶー])${escapeRe(key)}(?![ァ-ヶー])`)
        : new RegExp(escapeRe(key));
  return { key, zone, re };
});

export function isValidZone(zone: string): boolean {
  return IANAZone.isValidZone(zone) || /^UTC[+-]\d{1,2}(:\d{2})?$/.test(zone) || zone === "UTC";
}

/** "+9" / "+05:30" 形式を luxon が解釈できる固定オフセットゾーン名にする */
function offsetZone(sign: string, h: string, m?: string): string | null {
  const hh = Number(h);
  const mm = m ? Number(m) : 0;
  if (hh > 14 || mm >= 60) return null;
  return mm ? `UTC${sign}${hh}:${String(mm).padStart(2, "0")}` : `UTC${sign}${hh}`;
}

/**
 * 任意の文字列からタイムゾーンを推定する。見つからなければ null。
 * 優先順位: 明示オフセット > IANA 名 > 略称 > 地名/空港コード (文字列中で最も前に出現したもの)
 */
export function resolveTimezone(text: string | null | undefined): TimezoneMatch | null {
  if (!text) return null;
  const t = text.normalize("NFKC");
  if (t.trim() === "") return null;

  // 1) 明示オフセット: UTC+9, GMT+09:00, (GMT+7)
  const off = t.match(/(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?/i);
  if (off) {
    const z = offsetZone(off[1]!, off[2]!, off[3]);
    if (z) return { zone: z, source: "offset", matched: off[0] };
  }
  // ISO 形式のオフセット (+09:00)。時刻の直後などに現れる想定。
  const iso = t.match(/(?:(?<=\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?)|(?<![\w:+-]))([+-])(\d{2}):(\d{2})(?!\d)/);
  if (iso) {
    const z = offsetZone(iso[1]!, iso[2]!, iso[3]);
    if (z) return { zone: z, source: "offset", matched: iso[0] };
  }

  // 2) IANA 名がそのまま書かれている
  const ianaRe = /\b([A-Z][A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)\b/g;
  for (const m of t.matchAll(ianaRe)) {
    if (IANAZone.isValidZone(m[1]!)) return { zone: m[1]!, source: "iana", matched: m[1]! };
  }

  // 3) 略称 (大文字のみ・単語境界)
  for (const [abbr, zone] of Object.entries(ABBR_TO_ZONE)) {
    if (new RegExp(`(?<![A-Za-z])${abbr}(?![A-Za-z])`).test(t)) {
      return { zone, source: "abbr", matched: abbr };
    }
  }
  if (/GMT(?![+-]\s*\d)/.test(t)) return { zone: "UTC", source: "abbr", matched: "GMT" };

  // 4) 地名・空港コード: 最初に出現したもの (同じ位置なら長いもの) を採用
  let best: { idx: number; len: number; m: Matcher } | null = null;
  for (const m of NAME_MATCHERS) {
    const r = m.re.exec(t);
    if (!r) continue;
    const idx = r.index;
    if (!best || idx < best.idx || (idx === best.idx && m.key.length > best.len)) {
      best = { idx, len: m.key.length, m };
    }
  }
  if (best) return { zone: best.m.zone, source: "name", matched: best.m.key };
  return null;
}

/** 候補文字列を順に試し、最初に解決できたゾーンを返す。全滅なら fallback。 */
export function resolveTimezoneFrom(
  candidates: Array<string | null | undefined>,
  fallback: string,
): { zone: string; match: TimezoneMatch | null } {
  for (const c of candidates) {
    const m = resolveTimezone(c);
    if (m) return { zone: m.zone, match: m };
  }
  return { zone: fallback, match: null };
}
