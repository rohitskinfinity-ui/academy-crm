"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminGet } from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";

export type ReferralCodeValidation = {
  valid: boolean;
  empty?: boolean;
  code: string | null;
  message: string;
  referrer_first_name?: string | null;
  friend_discount?: number | null;
  currency?: string | null;
};

type Props = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function ReferralCodeField({
  id,
  label = "Referral code",
  value,
  onChange,
  placeholder = "Optional, e.g. AMAN7K",
  disabled,
  className,
}: Props) {
  const [status, setStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const code = value.trim();
    if (!code) {
      setStatus("idle");
      setHint(null);
      return;
    }

    let cancelled = false;
    setStatus("checking");
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await adminGet<ReferralCodeValidation>(
            "/api/admin/referrals/validate",
            { code },
          );
          if (cancelled) return;
          if (res.data.empty || !code) {
            setStatus("idle");
            setHint(null);
            return;
          }
          if (res.data.valid) {
            setStatus("valid");
            setHint(res.data.message);
          } else {
            setStatus("invalid");
            setHint(res.data.message || "Invalid referral code");
          }
        } catch {
          if (cancelled) return;
          setStatus("invalid");
          setHint("Could not verify referral code");
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value]);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={status === "invalid"}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
      {status === "checking" ? (
        <p className="text-xs text-muted-foreground">Checking coupon…</p>
      ) : null}
      {status === "valid" && hint ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">{hint}</p>
      ) : null}
      {status === "invalid" && hint ? (
        <p className="text-xs text-destructive">{hint}</p>
      ) : null}
    </div>
  );
}
