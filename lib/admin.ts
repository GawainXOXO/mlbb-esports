import "server-only";

/**
 * Penjaga rute admin. Login Google (Better Auth) dibuat di M3. Sampai saat itu admin hanya
 * tersedia di mesin dev lewat DEV_ADMIN_BYPASS, dan nilai itu selalu ditolak di produksi.
 */
export function isAdmin(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "development" && env.DEV_ADMIN_BYPASS === "true";
}

export function adminEmail(): string {
  return "dev-admin";
}
