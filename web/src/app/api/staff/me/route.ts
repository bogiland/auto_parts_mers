import { currentStaff } from "@/lib/staff-auth";
export const runtime = "nodejs";
export async function GET() {
  const staff = await currentStaff();
  return staff ? Response.json({ name: staff.name, role: staff.role }, { headers: { "Cache-Control": "no-store" } }) : new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
}
