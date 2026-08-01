"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { BrandLogo } from "@/components/admin/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/store/admin-auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const login = useAdminAuth((s) => s.login);
  const loading = useAdminAuth((s) => s.loading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login(email.trim(), password);
      toast.success("Welcome back");
      router.replace("/admin");
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message as string) || "Login failed"
        : "Login failed";
      toast.error(message);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 20% 10%, rgba(17,118,110,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 90%, rgba(17,118,110,0.08), transparent 50%), linear-gradient(165deg, #f8fbfb 0%, #e6f3f1 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-10 flex flex-col items-center text-center">
          <BrandLogo size={104} className="mb-6" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Skinfinity Academy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your CRM workspace
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border/80 bg-card/95 p-7 shadow-[0_24px_64px_-28px_rgba(10,10,11,0.35)] backdrop-blur-sm"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="mt-6 h-10 w-full"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
