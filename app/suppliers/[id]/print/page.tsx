"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Supplier = { id: number; name: string; city: string | null; code: string };
type LedgerEntry = {
  id: number;
  date: string;
  voucher_no: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
};

export default function SupplierPrintPage() {
  const params = useParams();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/suppliers/${params.id}/ledger`);
      const data = await res.json();
      setSupplier(data.supplier);
      setEntries(data.entries || []);
    }
    load();
  }, [params.id]);

  const closingBalance =
    entries.length > 0 ? Number(entries[entries.length - 1].balance) : 0;
  const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit), 0);
  const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit), 0);

  return (
    <div className="bg-white text-black p-10 max-w-4xl mx-auto text-sm">
      <div className="flex justify-between items-start border-b-2 border-[#10231E] pb-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#10231E]">
            Malik Yaseen & Company
          </h1>
          <p className="text-gray-600">Wheat Trading Business</p>
        </div>
        <div className="text-right text-gray-600">
          <p>Printed: {new Date().toLocaleString()}</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold">Account Statement</h2>
        <p className="text-gray-600">
          {supplier?.name} ({supplier?.code}) — {supplier?.city}
        </p>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y-2 border-[#10231E] text-left">
            <th className="p-2">V. No.</th>
            <th className="p-2">Date</th>
            <th className="p-2">Description</th>
            <th className="p-2 text-right">Debit</th>
            <th className="p-2 text-right">Credit</th>
            <th className="p-2 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b align-top">
              <td className="p-2 whitespace-nowrap">{e.voucher_no}</td>
              <td className="p-2 whitespace-nowrap">
                {new Date(e.date).toLocaleDateString()}
              </td>
              <td className="p-2">{e.description}</td>
              <td className="p-2 text-right whitespace-nowrap">
                {Number(e.debit) > 0 ? Number(e.debit).toLocaleString() : "-"}
              </td>
              <td className="p-2 text-right whitespace-nowrap">
                {Number(e.credit) > 0
                  ? Number(e.credit).toLocaleString()
                  : "-"}
              </td>
              <td className="p-2 text-right whitespace-nowrap font-medium">
                {Math.abs(Number(e.balance)).toLocaleString()}{" "}
                {Number(e.balance) >= 0 ? "Dr" : "Cr"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#10231E] font-semibold">
            <td colSpan={3} className="p-2 text-right">
              Total
            </td>
            <td className="p-2 text-right">{totalDebit.toLocaleString()}</td>
            <td className="p-2 text-right">{totalCredit.toLocaleString()}</td>
            <td className="p-2 text-right">
              {Math.abs(closingBalance).toLocaleString()}{" "}
              {closingBalance >= 0 ? "Dr" : "Cr"}
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-8 print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-[#1E6B52] text-white px-4 py-2 rounded hover:bg-[#175640]"
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}