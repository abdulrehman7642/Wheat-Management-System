import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { canAccessSettings } from "@/app/lib/permissions";

const DEFAULT_COMPANY = {
  name: "Malik Yaseen & Company",
  address: "",
  phone: "",
  city: "",
};

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessSettings(session)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

  const row = await prisma.settings.findUnique({ where: { key: "company_info" } });
  return NextResponse.json(row ? row.value : DEFAULT_COMPANY);
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const row = await prisma.settings.upsert({
    where: { key: "company_info" },
    update: { value: body },
    create: { key: "company_info", value: body },
  });

  return NextResponse.json(row.value);
}