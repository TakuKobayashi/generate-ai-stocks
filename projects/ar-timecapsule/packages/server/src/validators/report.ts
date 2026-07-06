import { z } from "zod";
export const createReportSchema = z.object({ reason: z.enum(["spam","harassment","sexual","gore","copyright","other"]), detail: z.string().max(1000).optional() });
export type CreateReportInput = z.infer<typeof createReportSchema>;
