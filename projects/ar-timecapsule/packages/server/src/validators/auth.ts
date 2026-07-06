import { z } from "zod";
const pwSchema = z.string().min(8).max(72).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/);
export const signUpSchema = z.object({ email: z.string().email().max(255), password: pwSchema, displayName: z.string().min(1).max(50).trim() });
export const storeSignUpSchema = z.object({ email: z.string().email().max(255), password: pwSchema, displayName: z.string().min(1).max(50).trim(), shopName: z.string().min(1).max(100).trim(), inviteCode: z.string().min(1) });
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export type SignUpInput = z.infer<typeof signUpSchema>;
export type StoreSignUpInput = z.infer<typeof storeSignUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
