"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BrandMark } from "@/components/ui/primitives";
import { ArrowRightIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormField, FormLabel, FormMessage } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginFormValues } from "@/lib/forms/auth";

function safeNextPath(): string | null {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setMessage("");
    setVerificationEmail("");
    try {
      const parsed = loginSchema.parse(values);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "เข้าสู่ระบบไม่สำเร็จ");
        if (result.code === "EMAIL_VERIFICATION_REQUIRED" && typeof result.verificationEmail === "string") {
          setVerificationEmail(result.verificationEmail);
        }
        return;
      }
      const isPrivileged = result.user?.role === "ADMIN" || result.user?.role === "SUPERADMIN";
      const canContinue = isPrivileged || result.user?.verificationStatus === "VERIFIED";
      const next = canContinue ? safeNextPath() : null;
      router.push(next ?? result.redirect ?? "/");
      router.refresh();
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อระบบเข้าสู่ระบบได้");
    }
  });

  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-6 text-[var(--ink)] sm:grid sm:place-items-center sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <Link href="/"><BrandMark /></Link>
          <Link href="/register" className="text-xs font-black text-[var(--gold-strong)]">สมัครสมาชิก</Link>
        </div>
        <Card className="mt-8 rounded-[28px]">
          <CardHeader className="pb-4 sm:p-8 sm:pb-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold-strong)]"><ShieldCheckIcon size={22} /></div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.045em]">ยินดีต้อนรับกลับ</h1>
            <p className="text-sm leading-6 text-[var(--muted)]">เข้าสู่บัญชีเพื่อจัดการการยืม แชต การชำระ และของที่คุณปล่อยให้ยืม</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-8 sm:pb-8">
            <form onSubmit={submit} className="space-y-4" noValidate>
              <FormField>
                <FormLabel htmlFor="login-email">อีเมล</FormLabel>
                <Input id="login-email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} {...register("email")} />
                <FormMessage>{errors.email?.message}</FormMessage>
              </FormField>
              <FormField>
                <div className="flex items-center justify-between gap-3">
                  <FormLabel htmlFor="login-password">รหัสผ่าน</FormLabel>
                  <Link href="/forgot-password" className="text-xs font-black text-[var(--gold-strong)]">ลืมรหัสผ่าน?</Link>
                </div>
                <Input id="login-password" type="password" autoComplete="current-password" placeholder="••••••••" aria-invalid={Boolean(errors.password)} {...register("password")} />
                <FormMessage>{errors.password?.message}</FormMessage>
              </FormField>
              {message && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                  <p>{message}</p>
                  {verificationEmail && <Link href={`/verify-email?email=${encodeURIComponent(verificationEmail)}`} className="mt-2 inline-block font-black underline underline-offset-4">ส่งลิงก์ยืนยันอีเมลอีกครั้ง</Link>}
                </div>
              )}
              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "กำลังเข้าสู่ระบบ..." : <>เข้าสู่ระบบ<ArrowRightIcon size={17} /></>}
              </Button>
            </form>
            <div className="mt-5 rounded-xl bg-[var(--surface-2)] p-3 text-xs leading-5 text-[var(--muted-strong)]">บัญชีที่ยังไม่ผ่าน KYC จะถูกพาไปยืนยันตัวตนก่อนปลดล็อกการยืมและปล่อยของ</div>
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs text-[var(--muted)]">ยังไม่มีบัญชี? <Link href="/register" className="font-black text-[var(--ink)] underline decoration-[var(--gold)] underline-offset-4">สร้างบัญชี Borow Borow</Link></p>
      </div>
    </main>
  );
}
