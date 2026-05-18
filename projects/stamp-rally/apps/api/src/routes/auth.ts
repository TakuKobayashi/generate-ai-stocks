import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { adminUsers } from '../db/schema';
import { hashPassword, verifyPassword, signJWT, generateId } from '../utils/crypto';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

// 管理者登録
app.post(
  '/register',
  zValidator(
    'json',
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(1),
    })
  ),
  async (c) => {
    const { email, password, name } = c.req.valid('json');
    const db = drizzle(c.env.DB);

    const existing = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).get();
    if (existing) {
      return c.json({ error: 'このメールアドレスは既に使用されています' }, 409);
    }

    const passwordHash = await hashPassword(password);
    const id = generateId();

    await db.insert(adminUsers).values({ id, email, passwordHash, name });

    const token = await signJWT({ sub: id, type: 'admin' }, c.env.JWT_SECRET);
    return c.json({ token, user: { id, email, name } }, 201);
  }
);

// 管理者ログイン
app.post(
  '/login',
  zValidator(
    'json',
    z.object({
      email: z.string().email(),
      password: z.string(),
    })
  ),
  async (c) => {
    const { email, password } = c.req.valid('json');
    const db = drizzle(c.env.DB);

    const user = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).get();
    if (!user) {
      return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401);
    }

    const token = await signJWT({ sub: user.id, type: 'admin' }, c.env.JWT_SECRET);
    return c.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  }
);

export default app;
