"use client";

import { ReactNode, useEffect, useState } from "react";

type Company = { name: string; address: string; phone: string; city: string };

function Logo() {
  return (
    <svg width={44} height={44} viewBox="0 0 48 48" fill="none">
      <line x1="24" y1="44" x2="24" y2="10" stroke="#B8860B" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 10 Q28 4 32 3" stroke="#B8860B" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <ellipse cx="24" cy="14" rx="4.5" ry="7" fill="#B8860B" />
      <ellipse cx="17" cy="18" rx="3.5" ry="6" fill="#B8860B" opacity="0.8" transform="rotate(-18 17 18)" />
      <ellipse cx="31" cy="18" rx="3.5" ry="6" fill="#B8860B" opacity="0.8" transform="rotate(18 31 18)" />
    </svg>
  );
}

export default function PrintHeader({ title, right }: { title: string; right?: ReactNode }) {
  const [company, setCompany] = useState<Company>({
    name: "Malik Yaseen & Company",
    address: "",
    phone: "",
    city: "",
  });

  useEffect(() => {
    fetch("/api/company")
      .then((res) => res.json())
      .then((d) => {
        if (d && d.name) setCompany(d);
      })
      .catch(() => {});
  }, []);

  const contact = [company.address, company.city, company.phone].filter(Boolean).join(" | ");

  return (
    <div className="flex justify-between items-start pb-5 mb-6" style={{ borderBottom: "3px solid #0A1628" }}>
      <div className="flex items-center gap-3">
        <Logo />
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#0A1628" }}>
            {company.name}
          </h1>
          {contact && <p className="text-gray-500 text-xs">{contact}</p>}
          <p className="text-gray-500 text-xs mt-0.5">{title}</p>
        </div>
      </div>
      <div className="text-right">{right}</div>
    </div>
  );
}