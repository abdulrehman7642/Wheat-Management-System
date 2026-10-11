"use client";

import { useParams } from "next/navigation";
import StatementView from "../../../components/StatementView";

export default function SupplierPrintPage() {
  const params = useParams();
  return <StatementView kind="supplier" id={String(params.id)} />;
}