import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

// Publik, jadi hanya ok/gagal. Tidak pernah membocorkan host, versi, atau pesan galat.
export async function GET() {
  try {
    await getPool().query("SELECT 1");
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
