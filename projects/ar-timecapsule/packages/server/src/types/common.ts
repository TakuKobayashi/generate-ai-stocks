export type UserRole = "user" | "moderator" | "admin" | "store";
export type CapsuleVisibility = "public" | "friends" | "private";
export type CapsuleStatus = "active" | "expired" | "removed" | "pending";

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
};

export type AuthUser = {
  userId: string;
  email: string;
  role: UserRole;
};

export type SuccessResponse<T> = { success: true; data: T };
export type ErrorResponse = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
