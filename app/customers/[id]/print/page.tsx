"use client";

import { useParams } from "next/navigation";
import StatementView from "../../../components/StatementView";

export default function CustomerPrintPage() {
  const params = useParams();
  return <StatementView kind="customer" id={String(params.id)} />;
}