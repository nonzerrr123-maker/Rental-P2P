"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BrandMark } from "@/components/ui/primitives";
import { ArrowRightIcon, CheckIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormField, FormLabel, FormMessage } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { emailOnlySchema, type EmailOnlyFormValues } from "@/lib/forms/auth";

export default function VerifyEmailPage() {
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailOnlyFormValues>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: "" },
  });

  async function verify() {
    if (verifying) return;
    const token = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
    if (!token) {
      setVerifyMessage("ลิงก์ยืนยันอีเมลไม่ถูกต้อง กรุณาขอลิงก์ใหม่ด้านล่าง");
      return;
    }
    setVerifyMessage("");
    setVerifying(true);
    try {
      const response = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setVerifyMessage(result.message ?? "ไม่สามารถยืนยันอีเมลได้");
        return;
      }
      setVerified(true);
      setVerifyMessage(result.message ?? "ยืนยันอีเมลเรียบร้อยแล้ว");
    } catch {
      setVerifyMessage("ไม่สามารถเชื่อมต่อระบบยืนยันอีเมลได้");
    } finally {
      setVerifying(false);
    }
  }

  const resend = handleSubmit(async (values) => {
    setResendMessage("");
    try {
      const parsed = emailOnlySchema.parse(values);
      const response = await fetch("/api/auth/email/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const result = await response.json();
      setResendMessage(result.message ?? (response.ok ? "ตรวจสอบกล่องอีเมลของคุณ" : "ไม่สามารถส่งอีเมลได้"));
    } catch {
      setResendMessage("ไม่สามารถเชื่อมต่อระบบอีเมลได้");
    }
  });

  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-6 text-[var(--ink)] sm:grid sm:place-items-center sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <Link href="/"><BrandMark /></Link>
          <Link href="/login" className="text-xs font-black text-[var(--gold-strong)]">เข้าสู่ระบบ</Link>
        </div>
        <Card className="mt-8 rounded-[28px]">
          <CardHeader className="pb-4 sm:p-8 sm:pb-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold-strong)]">{verified ? <CheckIcon size={22} /> : <ShieldCheckIcon size={22} />}</div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.045em]">ยืนยันอีเมล</h1>
            <p className="text-sm leading-6 text-[var(--muted)]">ยืนยันว่าอีเมลนี้เป็นของคุณ ก่อนเปิดใช้การป้องกันบัญชีด้วยอีเมลแบบเต็มรูปแบบ</p>
          </CardHeader>
          <CardContent className="space-y-6 px-5 pb-5 sm:px-8 sm:pb-8">
            {!verified && (
              <div className="space-y-3">
                <Button type="button" size="lg" disabled={verifying} onClick={verify} className="w-full">
                  {verifying ? "กำลังยืนยัน..." : <>ยืนยันอีเมลนี้<ArrowRightIcon size={17} /></>}
                </Button>
                {verifyMessage && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{verifyMessage}</p>}
              </div>
            )}

            {verified && (
              <div className="space-y-4">
                <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{verifyMessage}</p>
                <Link href="/login" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-black text-white">ไปเข้าสู่ระบบ<ArrowRightIcon size={17} /></Link>
              </div>
            )}

            {!verified && (
              <div className="border-t border-[var(--line)] pt-5">
                <p className="mb-3 text-sm font-black">ไม่ได้รับอีเมล หรือลิงก์หมดอายุ?</p>
                <form onSubmit={resend} className="space-y-3" noValidate>
                  <FormField>
                    <FormLabel htmlFor="verify-email-resend">อีเมล</FormLabel>
                    <Input id="verify-email-resend" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} {...register("email")} />
                    <FormMessage>{errors.email?.message}</FormMessage>
                  </FormField>
                  <Button type="submit" variant="secondary" disabled={isSubmitting} className="w-full">{isSubmitting ? "กำลังส่ง..." : "ส่งลิงก์ยืนยันอีกครั้ง"}</Button>
                  {resendMessage && <p role="status" className="rounded-xl bg-[var(--surface-2)] p-3 text-xs font-semibold leading-5 text-[var(--muted-strong)]">{resendMessage}</p>}
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
