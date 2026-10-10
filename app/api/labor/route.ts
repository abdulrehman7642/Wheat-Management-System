import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const laborSchema = z.object({
  date: z.string(),
  laborer_name: z.string().min(1),
  work_description: z.string().optional(),
  quantity: z.number().optional(),
  rate: z.number().optional(),
  total_amount: z.number().positive(),
  paid_amount: z.number().default(0),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.labor.findMany({ orderBy: { id: "desc" } });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = laborSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const docNum = await tx.document_numbering.update({
          where: { doc_type: "cash_payment" },
          data: { current_number: { increment: 1 } },
        });
        const voucherNo = `${docNum.prefix}-${docNum.current_number}`;

        return tx.labor.create({
          data: {
            voucher_no: voucherNo,
            date: new Date(d.date),
            laborer_name: d.laborer_name,
            work_description: d.work_description,
            quantity: d.quantity,
            rate: d.rate,
            total_amount: d.total_amount,
            paid_amount: d.paid_amount,
            remaining_amount: d.total_amount - d.paid_amount,
            created_by: session.userId,
          },
        });
      },
      { maxWait: 15000, timeout: 20000 }
    );

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Labor entry save nahi ho saki." },
      { status: 500 }
    );
  }
}