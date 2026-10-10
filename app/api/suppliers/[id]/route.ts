import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const supplierSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  city: z.string().optional(),
  phone: z.string().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const supplier = await prisma.suppliers.update({
    where: { id: parseInt(id) },
    data: parsed.data,
  });

  return NextResponse.json(supplier);
}