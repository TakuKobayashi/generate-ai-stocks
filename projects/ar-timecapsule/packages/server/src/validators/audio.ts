import { z } from "zod";
export const requestUploadUrlSchema = z.object({ timeCapsuleId: z.string().uuid(), fileName: z.string().min(1).max(255), mimeType: z.enum(["audio/mpeg","audio/mp4","audio/wav","audio/ogg","audio/webm"]), fileSize: z.number().int().positive().max(52_428_800) });
export const confirmUploadSchema = z.object({ audioFileId: z.string().uuid(), durationSeconds: z.number().positive().max(600).optional() });
export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>;
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
