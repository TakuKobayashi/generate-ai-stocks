import { and, eq } from "drizzle-orm";
import type { Database } from "../db";
import { couponRedemptions, type CouponRedemption, type NewCouponRedemption } from "../db/schema";
import { generateId } from "../utils/jwt";

export class CouponRedemptionRepository {
  constructor(private readonly db: Database) {}
  async findByUserAndCoupon(userId: string, couponId: string): Promise<CouponRedemption | null> {
    return (await this.db.select().from(couponRedemptions).where(and(eq(couponRedemptions.userId, userId), eq(couponRedemptions.couponId, couponId))).limit(1).all())[0] ?? null;
  }
  async create(data: Omit<NewCouponRedemption, "id" | "redeemedAt">): Promise<CouponRedemption> {
    const id = generateId(), now = new Date().toISOString();
    await this.db.insert(couponRedemptions).values({ id, ...data, redeemedAt: now });
    const r = (await this.db.select().from(couponRedemptions).where(eq(couponRedemptions.id, id)).limit(1).all())[0];
    if (!r) throw new Error("Failed to create coupon redemption");
    return r;
  }
}
