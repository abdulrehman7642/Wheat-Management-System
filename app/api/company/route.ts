import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

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

  const row = await prisma.settings.findUnique({ where: { key: "company_info" } });
  const value =
    row && typeof row.value === "object" && row.value !== null
      ? (row.value as Record<string, string>)
      : {};

  return NextResponse.json({
    ...DEFAULT_COMPANY,
    ...value,
    name: value.name || DEFAULT_COMPANY.name,
  });
}