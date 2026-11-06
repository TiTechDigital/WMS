import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="font-mono text-xs text-muted-foreground">404 · LOCATION NOT FOUND</div>
        <h1 className="mt-2 text-lg font-semibold">This bin doesn’t exist</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">The page you scanned could not be located in the system.</p>
        <Link href="/dashboard" className="mt-4 inline-flex h-8 items-center rounded-md bg-primary px-3 text-[13px] font-medium text-white">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
