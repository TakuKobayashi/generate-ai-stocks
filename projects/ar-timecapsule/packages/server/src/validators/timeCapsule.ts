import { z } from "zod";
export const createTimeCapsuleSchema = z.object({
  title: z.string().min(1).max(100).trim(),
  message: z.string().max(5000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  arAnchorId: z.string().max(255).optional(),
  visibility: z.enum(["public","friends","private"]).default("public"),
  expireAt: z.string().datetime().optional(),
  discoverRadiusMeters: z.number().int().min(10).max(1000).default(100),
  coupon: z.object({
    title: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    shopName: z.string().min(1).max(100),
    redemptionType: z.enum(["qr","code","screen"]),
    redemptionCode: z.string().max(255).optional(),
    redemptionQrData: z.string().max(2048).optional(),
    redeemLimit: z.number().int().positive().optional(),
    expireAt: z.string().datetime().optional(),
  }).optional(),
});
export const nearbySearchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50_000).default(500),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type CreateTimeCapsuleInput = z.infer<typeof createTimeCapsuleSchema>;
export type NearbySearchInput = z.infer<typeof nearbySearchSchema>;
