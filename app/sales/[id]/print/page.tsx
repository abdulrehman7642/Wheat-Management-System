"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import WhatsAppShare from "../../../components/WhatsAppShare";
import PrintHeader from "../../../components/PrintHeader";

type Sale = {
  voucher_no: string;
  date: string;
  customers: { name: string; phone: string | null; city: string | null };
  wheat_types: { name: string };
  vehicles: { vehicle_no: string } | null;
  net_weight_kg: string;
  maunds: string;
  rate_per_maund: string;
  wheat_amount: string;
  freight_amount: string;
  total_amount: string;
  received_amount: string;
  remaining_amount: string;
};

export default function SalePrintPage() {
  const params = useParams();
  const [sale, setSale] = useState<Sale | null>(null);

  useEffect(() => {
    fetch(`/api/sales/${params.id}`)
      .then((res) => res.json())
      .then(setSale);
  }, [params.id]);

  if (!sale) return <div className="p-10">Loading...</div>;

  const message = `Assalam-o-Alaikum,\nMalik Yaseen & Company\n\nSale Invoice: ${sale.voucher_no}\nCustomer: ${sale.customers.name}\nAmount: Rs. ${Number(sale.total_amount).toLocaleString()}\n\nThank you.`;

  const rs = (v: string) => `Rs. ${Number(v).toLocaleString()}`;
  const row = (label: string, value: string, bold = false) => (
    <tr className="border-b border-gray-200">
      <td className={`py-2 px-3 text-gray-500 ${bold ? "font-semibold text-gray-900" : ""}`}>{label}</td>
      <td className={`py-2 px-3 text-right ${bold ? "font-bold text-gray-900" : "text-gray-800"}`}>{value}</td>
    </tr>
  );

  return (
    <div className="bg-white text-black p-10 max-w-3xl mx-auto text-sm">
      <div id="print-area" className="bg-white text-black">
        <PrintHeader
          title="Wheat Sale Invoice"
          right={
            <>
              <p className="font-bold text-lg" style={{ color: "#B8860B" }}>
                {sale.voucher_no}
              </p>
              <p className="text-gray-500 text-xs">{new Date(sale.date).toLocaleDateString()}</p>
            </>
          }
        />

        <div className="mb-6 grid grid-cols-3 gap-4 bg-gray-50 rounded p-4">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Customer</p>
            <p className="font-semibold">{sale.customers.name}</p>
            {sale.customers.city && <p className="text-gray-500 text-xs">{sale.customers.city}</p>}
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Wheat Type</p>
            <p className="font-semibold">{sale.wheat_types.name}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Vehicle</p>
            <p className="font-semibold">{sale.vehicles?.vehicle_no || "-"}</p>
          </div>
        </div>

        <table className="w-full border-collapse mb-6">
          <tbody>
            {row("Net Weight", `${sale.net_weight_kg} KG`)}
            {row("Maunds", Number(sale.maunds).toFixed(2))}
            {row("Rate per Maund", rs(sale.rate_per_maund))}
            {row("Wheat Amount", rs(sale.wheat_amount))}
            {row("Freight", rs(sale.freight_amount))}
            {row("Total Amount", rs(sale.total_amount), true)}
            {row("Received", rs(sale.received_amount))}
            {row("Remaining", rs(sale.remaining_amount), true)}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 print:hidden mt-10">
        <button onClick={() => window.print()} className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800">
          Print / Save as PDF
        </button>
        <WhatsAppShare message={message} printElementId="print-area" fileName={`${sale.voucher_no}.pdf`} />
      </div>
    </div>
  );
}