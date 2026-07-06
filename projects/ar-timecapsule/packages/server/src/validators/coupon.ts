import { z } from "zod";
export const redeemCouponSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
export type RedeemCouponInput = z.infer<typeof redeemCouponSchema>;
