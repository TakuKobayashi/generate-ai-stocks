import { and, desc, eq, gt, gte, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "../db";
import { timeCapsules, type NewTimeCapsule, type TimeCapsule } from "../db/schema";
import { generateId, } from "../utils/jwt";
import { decodeCursor, encodeCursor } from "../utils/geohash";

export type TimeCapsuleRow = Pick<TimeCapsule,
  "id"|"userId"|"title"|"latitude"|"longitude"|"geohash"|"arAnchorId"|
  "visibility"|"status"|"mediaType"|"viewCount"|"reportCount"|
  "expireAt"|"discoverRadiusMeters"|"createdAt">;

export type NearbyQueryParams = {
  geohashPrefixes: string[];
  visibilities?: Array<"public"|"friends"|"private">;
  cursor?: string;
  limit: number;
  nowIso: string;
};

export type PagedResult = { items: TimeCapsuleRow[]; nextCursor: string | null };

export interface ITimeCapsuleRepository {
  findById(id: string): Promise<TimeCapsule | null>;
  create(data: Omit<NewTimeCapsule, "id"|"createdAt"|"updatedAt">): Promise<TimeCapsule>;
  findNearbyByGeohash(params: NearbyQueryParams): Promise<PagedResult>;
  findByUserId(userId: string, cursor?: string, limit?: number): Promise<PagedResult>;
  findAll(cursor?: string, limit?: number): Promise<PagedResult>;
  incrementViewCount(id: string): Promise<void>;
  incrementReportCount(id: string): Promise<void>;
  softDelete(id: string): Promise<void>;
  countByUserToday(userId: string): Promise<number>;
  updateMediaType(id: string, mediaType: "audio"|"none"): Promise<void>;
}

const FIELDS = {
  id: timeCapsules.id, userId: timeCapsules.userId, title: timeCapsules.title,
  latitude: timeCapsules.latitude, longitude: timeCapsules.longitude, geohash: timeCapsules.geohash,
  arAnchorId: timeCapsules.arAnchorId, visibility: timeCapsules.visibility, status: timeCapsules.status,
  mediaType: timeCapsules.mediaType, viewCount: timeCapsules.viewCount, reportCount: timeCapsules.reportCount,
  expireAt: timeCapsules.expireAt, discoverRadiusMeters: timeCapsules.discoverRadiusMeters, createdAt: timeCapsules.createdAt,
} as const;

export class D1TimeCapsuleRepository implements ITimeCapsuleRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<TimeCapsule | null> {
    return (await this.db.select().from(timeCapsules).where(eq(timeCapsules.id, id)).limit(1).all())[0] ?? null;
  }

  async create(data: Omit<NewTimeCapsule, "id"|"createdAt"|"updatedAt">): Promise<TimeCapsule> {
    const id = generateId(), now = new Date().toISOString();
    await this.db.insert(timeCapsules).values({ id, ...data, createdAt: now, updatedAt: now });
    const r = await this.findById(id);
    if (!r) throw new Error("Failed to create time capsule");
    return r;
  }

  async findNearbyByGeohash(params: NearbyQueryParams): Promise<PagedResult> {
    const { geohashPrefixes, visibilities = ["public"], cursor, limit, nowIso } = params;

    let cursorGeohash: string | undefined, cursorId: string | undefined;
    if (cursor) { const d = decodeCursor(cursor); if (d) { cursorGeohash = d.geohash; cursorId = d.id; } }

    const prefixConds = sql.join(
      geohashPrefixes.map((p) => sql`${timeCapsules.geohash} LIKE ${p + "%"}`),
      sql` OR `
    );
    const visConds = visibilities.map((v) => eq(timeCapsules.visibility, v));
    const visCond  = visConds.length === 1 ? visConds[0]! : or(...visConds)!;
    const notExpired = or(isNull(timeCapsules.expireAt), gt(timeCapsules.expireAt, nowIso))!;
    const cursorCond = (cursorGeohash && cursorId)
      ? or(gt(timeCapsules.geohash, cursorGeohash), and(eq(timeCapsules.geohash, cursorGeohash), gt(timeCapsules.id, cursorId)))!
      : undefined;
    const baseWhere = and(eq(timeCapsules.status, "active"), visCond, notExpired, sql`(${prefixConds})`, lt(timeCapsules.reportCount, 5))!;
    const whereClause = cursorCond ? and(baseWhere, cursorCond)! : baseWhere;

    const rows = await this.db.select(FIELDS).from(timeCapsules)
      .where(whereClause).orderBy(timeCapsules.geohash, timeCapsules.id).limit(limit + 1).all();

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      rows.pop();
      const last = rows[rows.length - 1]!;
      nextCursor = encodeCursor(last.geohash, last.id);
    }
    return { items: rows, nextCursor };
  }

  async findByUserId(userId: string, cursor?: string, limit = 20): Promise<PagedResult> {
    let cursorDate: string | undefined, cursorId: string | undefined;
    if (cursor) { const d = decodeCursor(cursor); if (d) { cursorDate = d.geohash; cursorId = d.id; } }
    const cursorCond = (cursorDate && cursorId)
      ? or(lt(timeCapsules.createdAt, cursorDate), and(eq(timeCapsules.createdAt, cursorDate), gt(timeCapsules.id, cursorId)))!
      : undefined;
    const whereClause = cursorCond ? and(eq(timeCapsules.userId, userId), cursorCond)! : eq(timeCapsules.userId, userId);
    const rows = await this.db.select(FIELDS).from(timeCapsules)
      .where(whereClause).orderBy(desc(timeCapsules.createdAt), timeCapsules.id).limit(limit + 1).all();
    let nextCursor: string | null = null;
    if (rows.length > limit) { rows.pop(); const l = rows[rows.length-1]!; nextCursor = encodeCursor(l.createdAt, l.id); }
    return { items: rows, nextCursor };
  }

  async findAll(cursor?: string, limit = 100): Promise<PagedResult> {
    let cursorDate: string | undefined, cursorId: string | undefined;
    if (cursor) { const d = decodeCursor(cursor); if (d) { cursorDate = d.geohash; cursorId = d.id; } }
    const cursorCond = (cursorDate && cursorId)
      ? or(lt(timeCapsules.createdAt, cursorDate), and(eq(timeCapsules.createdAt, cursorDate), gt(timeCapsules.id, cursorId)))!
      : undefined;
    const rows = await this.db.select(FIELDS).from(timeCapsules)
      .where(cursorCond).orderBy(desc(timeCapsules.createdAt), timeCapsules.id).limit(limit + 1).all();
    let nextCursor: string | null = null;
    if (rows.length > limit) { rows.pop(); const l = rows[rows.length-1]!; nextCursor = encodeCursor(l.createdAt, l.id); }
    return { items: rows, nextCursor };
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.db.update(timeCapsules).set({ viewCount: sql`${timeCapsules.viewCount} + 1`, updatedAt: new Date().toISOString() }).where(eq(timeCapsules.id, id));
  }
  async incrementReportCount(id: string): Promise<void> {
    await this.db.update(timeCapsules).set({ reportCount: sql`${timeCapsules.reportCount} + 1`, updatedAt: new Date().toISOString() }).where(eq(timeCapsules.id, id));
  }
  async softDelete(id: string): Promise<void> {
    await this.db.update(timeCapsules).set({ status: "removed", updatedAt: new Date().toISOString() }).where(eq(timeCapsules.id, id));
  }
  async countByUserToday(userId: string): Promise<number> {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const r = await this.db.select({ count: sql<number>`count(*)` }).from(timeCapsules)
      .where(and(eq(timeCapsules.userId, userId), gte(timeCapsules.createdAt, today.toISOString()))).all();
    return r[0]?.count ?? 0;
  }
  async updateMediaType(id: string, mediaType: "audio"|"none"): Promise<void> {
    await this.db.update(timeCapsules).set({ mediaType, updatedAt: new Date().toISOString() }).where(eq(timeCapsules.id, id));
  }
}
