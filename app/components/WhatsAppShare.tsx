"use client";

import { useState } from "react";
import { generatePdfFile } from "../lib/generatePdf";

export default function WhatsAppShare({
  message,
  printElementId,
  fileName,
}: {
  message: string;
  printElementId: string;
  fileName: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    setLoading(true);
    try {
      const file = await generatePdfFile(printElementId, fileName);

      const canShareFile =
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] });

      if (canShareFile) {
        await navigator.share({
          files: [file],
          text: message,
        });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        const encoded = encodeURIComponent(
          message + "\n\n(PDF download ho gaya hai — WhatsApp mein manually attach kar dein)"
        );
        window.open(`https://wa.me/?text=${encoded}`, "_blank");
      }
    } catch (err) {
      console.error(err);
      alert("PDF share nahi ho saka. Dobara koshish karein.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      className="bg-[#25D366] text-white px-4 py-2 rounded hover:bg-[#1fb855] transition print:hidden disabled:opacity-50"
    >
      {loading ? "Preparing PDF..." : "Share on WhatsApp"}
    </button>
  );
}