import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { refreshTokens, type NewRefreshToken, type RefreshToken } from "../db/schema";
import { generateId } from "../utils/jwt";

export class RefreshTokenRepository {
  constructor(private readonly db: Database) {}
  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return (await this.db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1).all())[0] ?? null;
  }
  async create(data: Omit<NewRefreshToken, "id" | "createdAt">): Promise<RefreshToken> {
    const id = generateId(), now = new Date().toISOString();
    await this.db.insert(refreshTokens).values({ id, ...data, createdAt: now });
    const r = (await this.db.select().from(refreshTokens).where(eq(refreshTokens.id, id)).limit(1).all())[0];
    if (!r) throw new Error("Failed to create refresh token");
    return r;
  }
  async revoke(id: string): Promise<void> {
    await this.db.update(refreshTokens).set({ revokedAt: new Date().toISOString() }).where(eq(refreshTokens.id, id));
  }
  async revokeAllByUserId(userId: string): Promise<void> {
    await this.db.update(refreshTokens).set({ revokedAt: new Date().toISOString() }).where(eq(refreshTokens.userId, userId));
  }
}
