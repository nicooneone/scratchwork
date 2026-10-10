"use client";
import { useParams, useSearchParams } from "next/navigation";
import NotebookView from "@/components/library/NotebookView";

export default function NotebookRoute() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  return <NotebookView key={id} id={id} initialPageId={sp.get("page") ?? undefined} mock={sp.get("mock") === "1"} />;
}
