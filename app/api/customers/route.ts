import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const customerSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  city: z.string().optional(),
  phone: z.string().optional(),
  opening_balance: z.number().default(0),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customers = await prisma.customers.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = customerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const customer = await prisma.customers.create({
    data: parsed.data,
  });

  return NextResponse.json(customer);
}