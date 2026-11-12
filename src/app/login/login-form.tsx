"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { LogoMark, PRODUCT_NAME } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/form-field";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [login, setLogin] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) {
      setError("Enter your employee ID (or email) and password.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Sign-in failed. Try again.");
        setPending(false);
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <LogoMark />
          <div className="leading-tight">
            <div className="text-sm font-semibold">
              {PRODUCT_NAME} <span className="font-normal text-muted-foreground">WMS</span>
            </div>
            <div className="text-2xs text-muted-foreground">Warehouse management</div>
          </div>
        </div>
        <div className="rounded-lg border bg-surface p-6 shadow-card">
          <h1 className="text-base font-semibold">Sign in</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Use your employee badge ID or work email.</p>
          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <Field label="Employee ID or email" htmlFor="login">
              <Input
                id="login"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="h-10"
                autoFocus
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent"
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-pressed={show}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            {error && (
              <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-text outline-none">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-2xs text-muted-foreground">Forgot your password? Ask your shift supervisor or an administrator to reset it.</p>
      </div>
    </main>
  );
}
