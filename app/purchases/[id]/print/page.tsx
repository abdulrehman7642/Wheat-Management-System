"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import WhatsAppShare from "../../../components/WhatsAppShare";
import PrintHeader from "../../../components/PrintHeader";

type Purchase = {
  voucher_no: string;
  date: string;
  suppliers: { name: string; phone: string | null; city: string | null };
  wheat_types: { name: string };
  vehicles: { vehicle_no: string } | null;
  gross_weight_kg: string;
  bags_weight_kg: string;
  net_weight_kg: string;
  maunds: string;
  rate_per_maund: string;
  wheat_amount: string;
  wheat_tax_amount: string;
  kanta_charges: string;
  unloading_charges: string;
  bags_amount: string;
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  generated_description: string;
};

export default function PurchasePrintPage() {
  const params = useParams();
  const [purchase, setPurchase] = useState<Purchase | null>(null);

  useEffect(() => {
    fetch(`/api/purchases/${params.id}`)
      .then((res) => res.json())
      .then(setPurchase);
  }, [params.id]);

  if (!purchase) return <div className="p-10">Loading...</div>;

  const message = `Assalam-o-Alaikum,\nMalik Yaseen & Company\n\nWheat Purchase Voucher: ${purchase.voucher_no}\nSupplier: ${purchase.suppliers.name}\nAmount: Rs. ${Number(purchase.total_amount).toLocaleString()}\n\nThank you.`;

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
          title="Wheat Purchase Voucher"
          right={
            <>
              <p className="font-bold text-lg" style={{ color: "#B8860B" }}>
                {purchase.voucher_no}
              </p>
              <p className="text-gray-500 text-xs">{new Date(purchase.date).toLocaleDateString()}</p>
            </>
          }
        />

        <div className="mb-6 grid grid-cols-3 gap-4 bg-gray-50 rounded p-4">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Supplier</p>
            <p className="font-semibold">{purchase.suppliers.name}</p>
            {purchase.suppliers.city && <p className="text-gray-500 text-xs">{purchase.suppliers.city}</p>}
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Wheat Type</p>
            <p className="font-semibold">{purchase.wheat_types.name}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">Vehicle</p>
            <p className="font-semibold">{purchase.vehicles?.vehicle_no || "-"}</p>
          </div>
        </div>

        <table className="w-full border-collapse mb-6">
          <tbody>
            {row("Gross Weight", `${purchase.gross_weight_kg} KG`)}
            {row("Bags Weight", `${purchase.bags_weight_kg} KG`)}
            {row("Net Weight", `${purchase.net_weight_kg} KG`)}
            {row("Maunds", Number(purchase.maunds).toFixed(2))}
            {row("Rate per Maund", rs(purchase.rate_per_maund))}
            {row("Wheat Amount", rs(purchase.wheat_amount))}
            {row("Less: Wheat Tax", rs(purchase.wheat_tax_amount))}
            {row("Less: Kanta Charges", rs(purchase.kanta_charges))}
            {row("Less: Unloading Charges", rs(purchase.unloading_charges))}
            {row("Total Amount", rs(purchase.total_amount), true)}
            {row("Paid Amount", rs(purchase.paid_amount))}
            {row("Remaining", rs(purchase.remaining_amount), true)}
          </tbody>
        </table>

        <div className="bg-gray-50 rounded p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Description</p>
          <p className="text-gray-700 text-xs leading-relaxed">{purchase.generated_description}</p>
        </div>
      </div>

      <div className="flex gap-3 print:hidden mt-10">
        <button onClick={() => window.print()} className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800">
          Print / Save as PDF
        </button>
        <WhatsAppShare message={message} printElementId="print-area" fileName={`${purchase.voucher_no}.pdf`} />
      </div>
    </div>
  );
}