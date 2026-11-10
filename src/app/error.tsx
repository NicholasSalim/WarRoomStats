"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Catch-all for anything the specific API error states don't cover.
export default function ErrorBoundary({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <AlertTriangle className="size-5 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">Something went wrong</p>
        <p className="text-sm text-muted-foreground">An unexpected error stopped this page from loading.</p>
      </div>
      <Button variant="outline" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
