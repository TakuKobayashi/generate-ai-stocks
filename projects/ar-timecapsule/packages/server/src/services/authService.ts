import type { Database } from "../db";
import { UserRepository } from "../repositories/userRepository";
import { RefreshTokenRepository } from "../repositories/refreshTokenRepository";
import { hashPassword, verifyPassword } from "../utils/password";
import { hashToken, issueTokenPair, type TokenPair } from "../utils/jwt";
import type { UserRole } from "../types/common";

const STORE_INVITE_CODE = "STORE-INVITE-2024";

type Config = { jwtSecret: string; accessExpiresIn: number; refreshExpiresIn: number };

export class AuthService {
  private readonly userRepo: UserRepository;
  private readonly rtRepo: RefreshTokenRepository;
  constructor(private readonly db: Database, private readonly config: Config) {
    this.userRepo = new UserRepository(db);
    this.rtRepo   = new RefreshTokenRepository(db);
  }

  async signUp(email: string, password: string, displayName: string, meta: { userAgent?: string; ipAddress?: string }) {
    if (await this.userRepo.findByEmail(email)) throw Object.assign(new Error("Email already exists"), { code: "EMAIL_ALREADY_EXISTS" });
    const user = await this.userRepo.create({ email, passwordHash: await hashPassword(password), displayName, role: "user", isBanned: false });
    const tokens = await this.issue(user.id, user.email, "user", meta);
    return { user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role }, tokens };
  }

  async storeSignUp(email: string, password: string, displayName: string, shopName: string, inviteCode: string, meta: { userAgent?: string; ipAddress?: string }) {
    if (inviteCode !== STORE_INVITE_CODE) throw Object.assign(new Error("Invalid invite code"), { code: "FORBIDDEN" });
    if (await this.userRepo.findByEmail(email)) throw Object.assign(new Error("Email already exists"), { code: "EMAIL_ALREADY_EXISTS" });
    const user = await this.userRepo.create({ email, passwordHash: await hashPassword(password), displayName, role: "store", isBanned: false, shopName });
    const tokens = await this.issue(user.id, user.email, "store", meta);
    return { user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, shopName: user.shopName }, tokens };
  }

  async login(email: string, password: string, meta: { userAgent?: string; ipAddress?: string }) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw Object.assign(new Error("Invalid credentials"), { code: "INVALID_CREDENTIALS" });
    if (user.isBanned) throw Object.assign(new Error("Account is banned"), { code: "ACCOUNT_BANNED" });
    if (!await verifyPassword(password, user.passwordHash)) throw Object.assign(new Error("Invalid credentials"), { code: "INVALID_CREDENTIALS" });
    const tokens = await this.issue(user.id, user.email, user.role as UserRole, meta);
    return { user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, shopName: user.shopName }, tokens };
  }

  async refresh(rawToken: string, meta: { userAgent?: string; ipAddress?: string }): Promise<TokenPair> {
    const hash = await hashToken(rawToken);
    const stored = await this.rtRepo.findByHash(hash);
    if (!stored) throw Object.assign(new Error("Invalid refresh token"), { code: "TOKEN_INVALID" });
    if (stored.revokedAt) { await this.rtRepo.revokeAllByUserId(stored.userId); throw Object.assign(new Error("Token revoked"), { code: "TOKEN_REVOKED" }); }
    if (stored.expiresAt < new Date().toISOString()) throw Object.assign(new Error("Token expired"), { code: "TOKEN_EXPIRED" });
    await this.rtRepo.revoke(stored.id);
    const user = await this.userRepo.findById(stored.userId);
    if (!user || user.isBanned) throw Object.assign(new Error("User not found"), { code: "UNAUTHORIZED" });
    return this.issue(user.id, user.email, user.role as UserRole, meta);
  }

  async logout(rawToken: string): Promise<void> {
    const hash = await hashToken(rawToken);
    const stored = await this.rtRepo.findByHash(hash);
    if (stored && !stored.revokedAt) await this.rtRepo.revoke(stored.id);
  }

  private async issue(userId: string, email: string, role: UserRole, meta: { userAgent?: string; ipAddress?: string }): Promise<TokenPair> {
    const tokens = await issueTokenPair(userId, email, role, this.config.jwtSecret, this.config.accessExpiresIn, this.config.refreshExpiresIn);
    await this.rtRepo.create({ userId, tokenHash: await hashToken(tokens.refreshToken), expiresAt: new Date(tokens.refreshExpiresAt * 1000).toISOString(), userAgent: meta.userAgent, ipAddress: meta.ipAddress });
    return tokens;
  }
}
