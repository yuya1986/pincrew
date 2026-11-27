export const LOGIN_ID_PATTERN = /^[a-z0-9_-]{3,30}$/;
export const INTERNAL_AUTH_DOMAIN = "auth.kokomemo.internal";

export function normalizeLoginId(value: string): string {
  return value.trim().toLowerCase();
}

export function isLoginId(value: string): boolean {
  return LOGIN_ID_PATTERN.test(value);
}

export function internalAuthEmail(loginId: string): string {
  return `${loginId}@${INTERNAL_AUTH_DOMAIN}`;
}

export function isInternalAuthEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(`@${INTERNAL_AUTH_DOMAIN}`));
}
