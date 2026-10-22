import { isOwner } from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOwner(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await prisma.financial_controls.findUnique({ where: { id: 1 } }));
}
// Enabling is deliberately not exposed by the application in this release.
export async function POST() {
  return NextResponse.json({ error: "Payment cancellation activation requires a separately approved production readiness procedure." }, { status: 403 });
}
