"use client";

import { useEffect, useState } from "react";
import PrintHeader from "./PrintHeader";
import WhatsAppShare from "./WhatsAppShare";

type Party = { id: number; name: string; code: string; city: string | null; phone: string | null };
type Entry = {
  id: number;
  date: string;
  voucher_no: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
};

const fmt = (n: number) => new Intl.NumberFormat("en-PK").format(Math.round(n));

export default function StatementView({ kind, id }: { kind: "supplier" | "customer"; id: string }) {
  const [party, setParty] = useState<Party | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [printedAt, setPrintedAt] = useState("");

  useEffect(() => {
    setPrintedAt(new Date().toLocaleString());
  }, []);

  useEffect(() => {
    fetch(`/api/${kind}s/${id}/ledger`)
      .then((res) => res.json())
      .then((d) => {
        setParty(d[kind]);
        setEntries(d.entries || []);
      });
  }, [kind, id]);

  // Supplier: positive balance = we owe = Cr. Customer: positive balance = they owe = Dr.
  const label = (b: number) => (kind === "supplier" ? (b >= 0 ? "Cr" : "Dr") : b >= 0 ? "Dr" : "Cr");

  const day = (e: Entry) => e.date.slice(0, 10);
  const before = from ? entries.filter((e) => day(e) < from) : [];
  const inRange = entries.filter((e) => (!from || day(e) >= from) && (!to || day(e) <= to));

  const opening = before.length ? Number(before[before.length - 1].balance) : 0;
  const closing = inRange.length ? Number(inRange[inRange.length - 1].balance) : opening;
  const totalDebit = inRange.reduce((s, e) => s + Number(e.debit), 0);
  const totalCredit = inRange.reduce((s, e) => s + Number(e.credit), 0);

  const period = `${from || "Start"} to ${to || "Today"}`;
  const message = `Assalam-o-Alaikum,\nMalik Yaseen & Company\n\nAapka account statement.\nPeriod: ${period}\nClosing Balance: Rs. ${fmt(Math.abs(closing))} ${label(closing)}\n\nThank you.`;

  const dateInput = "border border-gray-300 rounded px-2 py-1 text-sm text-black bg-white";

  return (
    <div className="bg-white text-black p-10 max-w-4xl mx-auto text-sm">
      <div className="print:hidden flex flex-wrap gap-4 items-end mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={dateInput} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={dateInput} />
        </div>
        {(from || to) && (
          <button
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="text-xs text-gray-500 underline pb-2"
          >
            Clear dates
          </button>
        )}
      </div>

      <div id="print-area" className="bg-white text-black">
        <PrintHeader
          title="Account Statement"
          right={
            <>
              <p className="text-gray-500 text-xs">Printed: {printedAt}</p>
              {(from || to) && <p className="text-gray-500 text-xs">Period: {period}</p>}
            </>
          }
        />

        <div className="mb-6 bg-gray-50 rounded p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide">
            {kind === "supplier" ? "Supplier Account" : "Customer Account"}
          </p>
          <p className="font-semibold">
            {party?.name} ({party?.code})
          </p>
          {party?.city && <p className="text-gray-500 text-xs">{party.city}</p>}
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left" style={{ borderTop: "2px solid #0A1628", borderBottom: "2px solid #0A1628" }}>
              <th className="p-2">V. No.</th>
              <th className="p-2">Date</th>
              <th className="p-2">Description</th>
              <th className="p-2 text-right">Debit</th>
              <th className="p-2 text-right">Credit</th>
              <th className="p-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {from && (
              <tr className="border-b border-gray-200">
                <td colSpan={5} className="p-2 font-semibold">
                  Opening Balance
                </td>
                <td className="p-2 text-right font-semibold whitespace-nowrap">
                  {fmt(Math.abs(opening))} {label(opening)}
                </td>
              </tr>
            )}
            {inRange.map((e) => (
              <tr key={e.id} className="border-b border-gray-200 align-top">
                <td className="p-2 whitespace-nowrap">{e.voucher_no}</td>
                <td className="p-2 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                <td className="p-2 text-xs">{e.description}</td>
                <td className="p-2 text-right whitespace-nowrap">{Number(e.debit) > 0 ? fmt(Number(e.debit)) : "-"}</td>
                <td className="p-2 text-right whitespace-nowrap">{Number(e.credit) > 0 ? fmt(Number(e.credit)) : "-"}</td>
                <td className="p-2 text-right whitespace-nowrap font-medium">
                  {fmt(Math.abs(Number(e.balance)))} {label(Number(e.balance))}
                </td>
              </tr>
            ))}
            {inRange.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-400">
                  Is muddat mein koi entry nahi.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-semibold" style={{ borderTop: "2px solid #0A1628" }}>
              <td colSpan={3} className="p-2 text-right">
                Total / Closing Balance
              </td>
              <td className="p-2 text-right">{fmt(totalDebit)}</td>
              <td className="p-2 text-right">{fmt(totalCredit)}</td>
              <td className="p-2 text-right whitespace-nowrap">
                {fmt(Math.abs(closing))} {label(closing)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex gap-3 print:hidden mt-8">
        <button onClick={() => window.print()} className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800">
          Print / Save as PDF
        </button>
        <WhatsAppShare
          message={message}
          printElementId="print-area"
          fileName={`Statement-${party?.code || kind}.pdf`}
        />
      </div>
    </div>
  );
}
