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
import { registerSchema, type RegisterFormValues } from "@/lib/forms/auth";

export default function RegisterPage() {
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setMessage("");
    try {
      const parsed = registerSchema.parse(values);
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "สมัครสมาชิกไม่สำเร็จ");
        return;
      }
      setRegisteredEmail(result.user?.email ?? parsed.email);
      setVerificationSent(result.emailVerification?.sent === true);
      setVerificationRequired(result.emailVerification?.required === true);
      setDone(true);
      resetField("password");
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อระบบสมัครสมาชิกได้");
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
          {done ? (
            <CardContent className="px-5 py-10 text-center sm:px-8">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckIcon size={26} /></div>
              <h1 className="mt-5 text-2xl font-black tracking-[-0.035em]">สร้างบัญชีเรียบร้อย</h1>
              {verificationSent ? (
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">เราส่งลิงก์ยืนยันไปที่ <span className="font-black text-[var(--ink)]">{registeredEmail}</span> แล้ว ยืนยันอีเมลก่อนเพื่อเพิ่มความปลอดภัยให้บัญชี</p>
              ) : (
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">สร้างบัญชีแล้ว แต่ระบบอีเมลยังส่งลิงก์ยืนยันไม่สำเร็จ คุณสามารถขอส่งใหม่จากหน้า Verify Email ได้</p>
              )}
              <div className="mt-6 grid gap-3">
                <Link href={`/verify-email?email=${encodeURIComponent(registeredEmail)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-black text-white">ไปหน้ายืนยันอีเมล<ArrowRightIcon size={17} /></Link>
                {!verificationRequired && <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-black">เข้าสู่ระบบก่อน แล้วทำ KYC ต่อ</Link>}
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-4 sm:p-8 sm:pb-4">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold-strong)]"><ShieldCheckIcon size={22} /></div>
                <h1 className="mt-4 text-3xl font-black tracking-[-0.045em]">เริ่มใช้ Borow Borow</h1>
                <p className="text-sm leading-6 text-[var(--muted)]">บัญชีเดียวใช้ได้ทั้งยืมของ ปล่อยของ และโพสต์หาใน Community</p>
              </CardHeader>
              <CardContent className="px-5 pb-5 sm:px-8 sm:pb-8">
                <form onSubmit={submit} className="space-y-4" noValidate>
                  <FormField>
                    <FormLabel htmlFor="register-name">ชื่อที่แสดง</FormLabel>
                    <Input id="register-name" autoComplete="name" placeholder="ชื่อที่คนอื่นจะเห็น" aria-invalid={Boolean(errors.displayName)} {...register("displayName")} />
                    <FormMessage>{errors.displayName?.message}</FormMessage>
                  </FormField>
                  <FormField>
                    <FormLabel htmlFor="register-email">อีเมล</FormLabel>
                    <Input id="register-email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} {...register("email")} />
                    <FormMessage>{errors.email?.message}</FormMessage>
                  </FormField>
                  <FormField>
                    <FormLabel htmlFor="register-password">รหัสผ่าน</FormLabel>
                    <Input id="register-password" type="password" autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" aria-invalid={Boolean(errors.password)} {...register("password")} />
                    <FormMessage>{errors.password?.message}</FormMessage>
                  </FormField>
                  {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}
                  <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? "กำลังสร้างบัญชี..." : <>สร้างบัญชี<ArrowRightIcon size={17} /></>}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
        <p className="mt-5 text-center text-xs text-[var(--muted)]">มีบัญชีแล้ว? <Link href="/login" className="font-black text-[var(--ink)] underline decoration-[var(--gold)] underline-offset-4">เข้าสู่ระบบ</Link></p>
      </div>
    </main>
  );
}
