// Owner: C. Placeholder from Step 0 — the notebook library replaces this in Step 3.
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="font-hand text-6xl leading-none">
        Scratch<span className="text-pen">work</span>
      </h1>
      <p className="text-lg text-ink-soft">The notebook that checks your thinking, not just your answer.</p>
      <Link href="/dev/canvas" className="w-fit rounded-md bg-ink px-4 py-2 font-medium text-paper">
        Open the canvas test page
      </Link>
    </main>
  );
}
