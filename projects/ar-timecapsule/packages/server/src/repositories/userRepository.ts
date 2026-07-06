import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { users, type NewUser, type User } from "../db/schema";
import { generateId } from "../utils/jwt";

export class UserRepository {
  constructor(private readonly db: Database) {}
  async findById(id: string): Promise<User | null> {
    return (await this.db.select().from(users).where(eq(users.id, id)).limit(1).all())[0] ?? null;
  }
  async findByEmail(email: string): Promise<User | null> {
    return (await this.db.select().from(users).where(eq(users.email, email)).limit(1).all())[0] ?? null;
  }
  async create(data: Omit<NewUser, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const id = generateId(), now = new Date().toISOString();
    await this.db.insert(users).values({ id, ...data, createdAt: now, updatedAt: now });
    const u = await this.findById(id);
    if (!u) throw new Error("Failed to create user");
    return u;
  }
}
