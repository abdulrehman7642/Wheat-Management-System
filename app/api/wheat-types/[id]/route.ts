import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const schema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  default_unit_id: z.number().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.roleName !== "owner" && session.roleName !== "accountant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const wheatTypeId = parseInt(id);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const d = parsed.data;

  const current = await prisma.wheat_types.findUnique({ where: { id: wheatTypeId } });
  if (!current) {
    return NextResponse.json({ error: "Wheat type nahi mili." }, { status: 404 });
  }

  if (d.default_unit_id !== undefined && d.default_unit_id !== current.default_unit_id) {
    const used = await prisma.inventory_transactions.count({
      where: { wheat_type_id: wheatTypeId },
    });
    if (used > 0) {
      return NextResponse.json(
        {
          error:
            "Is wheat type ki entries ban chuki hain, isliye unit nahi badal sakte. Naya wheat type banayein.",
        },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.wheat_types.update({
    where: { id: wheatTypeId },
    data: {
      name: d.name,
      category: d.category ?? null,
      ...(d.default_unit_id !== undefined ? { default_unit_id: d.default_unit_id } : {}),
      ...(d.status ? { status: d.status } : {}),
    },
  });

  return NextResponse.json(updated);
}