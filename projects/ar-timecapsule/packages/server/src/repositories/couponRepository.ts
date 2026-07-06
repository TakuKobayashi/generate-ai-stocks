import { eq, sql } from "drizzle-orm";
import type { Database } from "../db";
import { coupons, type Coupon, type NewCoupon } from "../db/schema";
import { generateId } from "../utils/jwt";

export class CouponRepository {
  constructor(private readonly db: Database) {}
  async findById(id: string): Promise<Coupon | null> {
    return (await this.db.select().from(coupons).where(eq(coupons.id, id)).limit(1).all())[0] ?? null;
  }
  async findByTimeCapsuleId(tcId: string): Promise<Coupon | null> {
    return (await this.db.select().from(coupons).where(eq(coupons.timeCapsuleId, tcId)).limit(1).all())[0] ?? null;
  }
  async create(data: Omit<NewCoupon, "id" | "createdAt" | "updatedAt">): Promise<Coupon> {
    const id = generateId(), now = new Date().toISOString();
    await this.db.insert(coupons).values({ id, ...data, createdAt: now, updatedAt: now });
    const r = await this.findById(id);
    if (!r) throw new Error("Failed to create coupon");
    return r;
  }
  async incrementRedeemCount(id: string): Promise<void> {
    await this.db.update(coupons).set({ redeemCount: sql`${coupons.redeemCount} + 1`, updatedAt: new Date().toISOString() }).where(eq(coupons.id, id));
  }
}
