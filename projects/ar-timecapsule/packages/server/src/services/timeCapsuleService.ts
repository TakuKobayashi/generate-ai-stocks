import type { Database } from "../db";
import { D1TimeCapsuleRepository, type ITimeCapsuleRepository, type TimeCapsuleRow } from "../repositories/timeCapsuleRepository";
import { AudioFileRepository } from "../repositories/audioFileRepository";
import { CouponRepository } from "../repositories/couponRepository";
import { encodeGeohash, getSearchPrefixes, calculateDistanceMeters, encodeCursor } from "../utils/geohash";
import { generatePresignedUrl } from "../utils/signedUrl";
import type { CreateTimeCapsuleInput } from "../validators/timeCapsule";

export type NearbyServiceInput = { latitude: number; longitude: number; radiusMeters: number; limit: number; cursor?: string };
export type NearbyItem = TimeCapsuleRow & { distanceMeters: number };
export type NearbyResult = { items: NearbyItem[]; nextCursor: string | null; total: number };

type Config = { r2AccountId: string; r2AccessKeyId: string; r2SecretAccessKey: string; r2BucketName: string; signedUrlExpiresIn: number; maxCapsulesPerDay: number; maxRadiusMeters: number };

const CACHE_TTL = 30;
const CACHE_NAME = "nearby-search-v1";

function buildCacheKey(prefixes: string[], radius: number, limit: number, cursor?: string): string {
  return `https://cache.internal/nearby/${[...prefixes].sort().join(",")}/${radius}/${limit}/${cursor ?? "start"}`;
}

export class TimeCapsuleService {
  private readonly repo: ITimeCapsuleRepository;
  private readonly audioRepo: AudioFileRepository;
  private readonly couponRepo: CouponRepository;

  constructor(private readonly db: Database, private readonly config: Config) {
    this.repo      = new D1TimeCapsuleRepository(db);
    this.audioRepo = new AudioFileRepository(db);
    this.couponRepo= new CouponRepository(db);
  }

  async create(userId: string, input: CreateTimeCapsuleInput) {
    if (await this.repo.countByUserToday(userId) >= this.config.maxCapsulesPerDay)
      throw Object.assign(new Error("Daily limit exceeded"), { code: "DAILY_LIMIT_EXCEEDED" });
    const capsule = await this.repo.create({
      userId, title: input.title, message: input.message,
      latitude: input.latitude, longitude: input.longitude,
      geohash: encodeGeohash(input.latitude, input.longitude, 9),
      arAnchorId: input.arAnchorId, visibility: input.visibility,
      expireAt: input.expireAt, mediaType: "none", status: "active",
      discoverRadiusMeters: input.discoverRadiusMeters ?? 100,
    });
    if (input.coupon) await this.couponRepo.create({ timeCapsuleId: capsule.id, ...input.coupon, redeemCount: 0, isActive: true });
    return capsule;
  }

  async findNearby(input: NearbyServiceInput, cacheCtx?: { cache: Cache; waitUntil: (p: Promise<unknown>) => void }): Promise<NearbyResult> {
    const radiusMeters = Math.min(input.radiusMeters, this.config.maxRadiusMeters);
    const limit = Math.min(input.limit, 100);
    const prefixes = getSearchPrefixes(input.latitude, input.longitude, radiusMeters);
    const cacheKey = buildCacheKey(prefixes, radiusMeters, limit, input.cursor);

    if (cacheCtx) {
      const cached = await cacheCtx.cache.match(cacheKey);
      if (cached) return cached.json() as Promise<NearbyResult>;
    }

    const { items: raw } = await this.repo.findNearbyByGeohash({
      geohashPrefixes: prefixes, visibilities: ["public"],
      cursor: input.cursor, limit: Math.min(limit * 3, 300),
      nowIso: new Date().toISOString(),
    });

    const filtered: NearbyItem[] = raw
      .map((item) => ({ ...item, distanceMeters: calculateDistanceMeters(input.latitude, input.longitude, item.latitude, item.longitude) }))
      .filter((item) => item.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    let nextCursor: string | null = null;
    if (filtered.length === limit) {
      const last = filtered[filtered.length - 1]!;
      nextCursor = encodeCursor(last.geohash, last.id);
    }

    const result: NearbyResult = { items: filtered, nextCursor, total: filtered.length };

    if (cacheCtx) {
      const res = new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_TTL}` },
      });
      cacheCtx.waitUntil(cacheCtx.cache.put(cacheKey, res));
    }
    return result;
  }

  static async openCache(): Promise<Cache> { return caches.open(CACHE_NAME); }

  async findById(id: string, requestUserId?: string) {
    const capsule = await this.repo.findById(id);
    if (!capsule || capsule.status === "removed") throw Object.assign(new Error("Capsule not found"), { code: "NOT_FOUND" });
    if (capsule.visibility === "private" && capsule.userId !== requestUserId) throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
    if (capsule.expireAt && capsule.expireAt < new Date().toISOString()) throw Object.assign(new Error("Capsule expired"), { code: "CAPSULE_EXPIRED" });

    const audioFile = await this.audioRepo.findByTimeCapsuleId(id);
    let audioSignedUrl: string | null = null;
    if (audioFile?.isConfirmed) {
      audioSignedUrl = await generatePresignedUrl({ accountId: this.config.r2AccountId, accessKeyId: this.config.r2AccessKeyId, secretAccessKey: this.config.r2SecretAccessKey, bucketName: this.config.r2BucketName, key: audioFile.r2Key, expiresIn: this.config.signedUrlExpiresIn });
    }
    const coupon = await this.couponRepo.findByTimeCapsuleId(id);
    return {
      id: capsule.id, userId: capsule.userId, title: capsule.title, message: capsule.message,
      latitude: capsule.latitude, longitude: capsule.longitude, arAnchorId: capsule.arAnchorId,
      visibility: capsule.visibility, status: capsule.status, mediaType: capsule.mediaType,
      expireAt: capsule.expireAt, viewCount: capsule.viewCount, discoverRadiusMeters: capsule.discoverRadiusMeters, createdAt: capsule.createdAt,
      audio: audioFile ? { id: audioFile.id, signedUrl: audioSignedUrl, mimeType: audioFile.mimeType, fileSize: audioFile.fileSize, durationSeconds: audioFile.durationSeconds } : null,
      coupon: coupon ? { id: coupon.id, title: coupon.title, description: coupon.description, shopName: coupon.shopName, redemptionType: coupon.redemptionType, redeemLimit: coupon.redeemLimit, redeemCount: coupon.redeemCount, expireAt: coupon.expireAt } : null,
    };
  }

  async findByUser(userId: string, cursor?: string, limit = 20) { return this.repo.findByUserId(userId, cursor, limit); }
  async findAll(cursor?: string, limit = 100) { return this.repo.findAll(cursor, limit); }

  async delete(id: string, userId: string, role: string): Promise<void> {
    const capsule = await this.repo.findById(id);
    if (!capsule) throw Object.assign(new Error("Capsule not found"), { code: "NOT_FOUND" });
    if (capsule.userId !== userId && role !== "admin" && role !== "moderator") throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
    await this.repo.softDelete(id);
  }

  incrementViewCount(id: string) { return this.repo.incrementViewCount(id); }

  async incrementReportCount(id: string): Promise<void> {
    await this.repo.incrementReportCount(id);
    const c = await this.repo.findById(id);
    if (c && c.reportCount >= 5) await this.repo.softDelete(id);
  }

  updateMediaType(id: string, mediaType: "audio"|"none") { return this.repo.updateMediaType(id, mediaType); }
}
