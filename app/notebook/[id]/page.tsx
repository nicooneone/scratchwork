// Owner: C. An open notebook. Notebooks live on the device (IndexedDB), so the route renders a static
// shell and reads its params on the client. ?page=<id> opens a page (Ask citations); ?mock=1 uses sample AI.
import { Suspense } from "react";
import NotebookRoute from "./NotebookRoute";

export default function NotebookPage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-desk" />}>
      <NotebookRoute />
    </Suspense>
  );
}
