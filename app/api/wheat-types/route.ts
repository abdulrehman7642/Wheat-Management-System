import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const wheatTypeSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  default_unit_id: z.number(),
});

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Dropdowns get only active types; the management page asks for ?all=1
  const all = new URL(request.url).searchParams.get("all") === "1";

  const wheatTypes = await prisma.wheat_types.findMany({
    where: all ? {} : { status: "active" },
    include: { units: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(wheatTypes);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = wheatTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const wheatType = await prisma.wheat_types.create({ data: parsed.data });
  return NextResponse.json(wheatType);
}