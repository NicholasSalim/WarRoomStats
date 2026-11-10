import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="tabular text-5xl font-semibold tracking-tight">404</p>
      <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
      <Link href="/" className="text-sm underline underline-offset-4 hover:text-foreground">
        Back to search
      </Link>
    </div>
  );
}
