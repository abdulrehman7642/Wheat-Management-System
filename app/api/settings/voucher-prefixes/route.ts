import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { canAccessSettings } from "@/app/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.document_numbering.findMany({ orderBy: { doc_type: "asc" } });
  return NextResponse.json(rows);
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessSettings(session)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

  const { doc_type, prefix } = await request.json();

  const row = await prisma.document_numbering.update({
    where: { doc_type },
    data: { prefix },
  });

  return NextResponse.json(row);
}