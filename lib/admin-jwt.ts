/** Single source of truth — must match how /api/auth/login signs admin_token. */
export const ADMIN_JWT_SECRET =
  process.env.JWT_SECRET?.trim() ||
  process.env.ACCESS_TOKEN_SECRET?.trim() ||
  'fallback_secret';
