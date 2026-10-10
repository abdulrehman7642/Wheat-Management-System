import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const bagSchema = z.object({
  date: z.string(),
  bag_type: z.string().min(1),
  size_kg: z.number().optional(),
  quantity: z.number().positive(),
  rate: z.number().default(0),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.bag_types.findMany({ orderBy: { id: "desc" } });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = bagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const d = parsed.data;

  const bagType = await prisma.bag_types.create({
    data: {
      name: d.bag_type,
      size_kg: d.size_kg,
    },
  });

  return NextResponse.json(bagType);
}