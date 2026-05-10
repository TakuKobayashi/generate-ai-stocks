import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  // wrangler d1 migrations apply が参照するデフォルトパスに合わせる
  out: './migrations',
  dialect: 'sqlite',
} satisfies Config;
