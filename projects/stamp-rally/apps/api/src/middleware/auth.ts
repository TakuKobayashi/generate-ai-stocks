import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { verifyJWT } from '../utils/crypto';
import type { Env } from '../index';

export type AuthVariables = {
  adminUserId: string;
  userId: string;
};

/**
 * 管理者認証ミドルウェア
 */
export const adminAuth = createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: '認証が必要です' });
    }

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (!payload || payload.type !== 'admin') {
      throw new HTTPException(401, { message: 'トークンが無効です' });
    }

    c.set('adminUserId', payload.sub as string);
    await next();
  }
);

/**
 * ユーザー認証ミドルウェア (任意 - ゲストも許可)
 */
export const optionalUserAuth = createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      if (payload && (payload.type === 'user' || payload.type === 'guest')) {
        c.set('userId', payload.sub as string);
      }
    }
    await next();
  }
);

/**
 * ユーザー認証ミドルウェア (必須)
 */
export const userAuth = createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: '認証が必要です' });
    }

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (!payload || (payload.type !== 'user' && payload.type !== 'guest')) {
      throw new HTTPException(401, { message: 'トークンが無効です' });
    }

    c.set('userId', payload.sub as string);
    await next();
  }
);
