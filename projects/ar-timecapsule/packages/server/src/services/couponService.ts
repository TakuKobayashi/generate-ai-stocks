import type { Database } from "../db";
import { CouponRepository } from "../repositories/couponRepository";
import { CouponRedemptionRepository } from "../repositories/couponRedemptionRepository";
import { D1TimeCapsuleRepository } from "../repositories/timeCapsuleRepository";
import { calculateDistanceMeters } from "../utils/geohash";
import type { RedeemCouponInput } from "../validators/coupon";

export class CouponService {
  private readonly couponRepo: CouponRepository;
  private readonly redemptionRepo: CouponRedemptionRepository;
  private readonly capsuleRepo: D1TimeCapsuleRepository;
  constructor(private readonly db: Database, private readonly config: { redeemRadiusM: number }) {
    this.couponRepo    = new CouponRepository(db);
    this.redemptionRepo= new CouponRedemptionRepository(db);
    this.capsuleRepo   = new D1TimeCapsuleRepository(db);
  }
  async findById(couponId: string, userId: string) {
    const coupon = await this.couponRepo.findById(couponId);
    if (!coupon || !coupon.isActive) throw Object.assign(new Error("Coupon not found"), { code: "NOT_FOUND" });
    if (coupon.expireAt && coupon.expireAt < new Date().toISOString()) throw Object.assign(new Error("Coupon expired"), { code: "COUPON_EXPIRED" });
    const redeemed = await this.redemptionRepo.findByUserAndCoupon(userId, couponId);
    return { id: coupon.id, title: coupon.title, description: coupon.description, shopName: coupon.shopName, redemptionType: coupon.redemptionType, redeemLimit: coupon.redeemLimit, redeemCount: coupon.redeemCount, expireAt: coupon.expireAt, isRedeemed: !!redeemed, redeemedAt: redeemed?.redeemedAt ?? null };
  }
  async redeem(userId: string, couponId: string, input: RedeemCouponInput) {
    const coupon = await this.couponRepo.findById(couponId);
    if (!coupon || !coupon.isActive) throw Object.assign(new Error("Coupon not found"), { code: "NOT_FOUND" });
    if (coupon.expireAt && coupon.expireAt < new Date().toISOString()) throw Object.assign(new Error("Coupon expired"), { code: "COUPON_EXPIRED" });
    if (coupon.redeemLimit !== null && coupon.redeemCount >= coupon.redeemLimit) throw Object.assign(new Error("Limit reached"), { code: "COUPON_LIMIT_REACHED" });
    if (await this.redemptionRepo.findByUserAndCoupon(userId, couponId)) throw Object.assign(new Error("Already redeemed"), { code: "ALREADY_REDEEMED" });
    const capsule = await this.capsuleRepo.findById(coupon.timeCapsuleId);
    if (!capsule) throw Object.assign(new Error("Capsule not found"), { code: "NOT_FOUND" });
    const dist = calculateDistanceMeters(input.latitude, input.longitude, capsule.latitude, capsule.longitude);
    if (dist > this.config.redeemRadiusM) throw Object.assign(new Error(`Must be within ${this.config.redeemRadiusM}m`), { code: "TOO_FAR_FROM_CAPSULE", details: { distanceMeters: Math.round(dist) } });
    await this.redemptionRepo.create({ couponId, userId, latitude: input.latitude, longitude: input.longitude });
    await this.couponRepo.incrementRedeemCount(couponId);
    return { id: coupon.id, title: coupon.title, description: coupon.description, shopName: coupon.shopName, redemptionType: coupon.redemptionType, redemptionCode: coupon.redemptionType !== "screen" ? coupon.redemptionCode : null, redemptionQrData: coupon.redemptionType === "qr" ? coupon.redemptionQrData : null, expireAt: coupon.expireAt };
  }
}
