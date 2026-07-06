export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  SIGNED_URL_EXPIRES_IN: string;
  MAX_AUDIO_FILE_SIZE: string;
  RATE_LIMIT_REQUESTS: string;
  RATE_LIMIT_WINDOW: string;
  MAX_CAPSULES_PER_USER_PER_DAY: string;
  NEARBY_SEARCH_MAX_RADIUS_KM: string;
  COUPON_REDEEM_RADIUS_M: string;
  JWT_SECRET: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
};
