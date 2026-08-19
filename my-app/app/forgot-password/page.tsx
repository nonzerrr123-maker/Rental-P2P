"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BrandMark } from "@/components/ui/primitives";
import { ArrowRightIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormField, FormLabel, FormMessage } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { emailOnlySchema, type EmailOnlyFormValues } from "@/lib/forms/auth";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailOnlyFormValues>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: "" },
  });

  const submit = handleSubmit(async (values) => {
    setMessage("");
    try {
      const parsed = emailOnlySchema.parse(values);
      const response = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "ไม่สามารถส่งลิงก์ตั้งรหัสผ่านได้");
        return;
      }
      setDone(true);
      setMessage(result.message ?? "หากอีเมลนี้มีบัญชี ระบบจะส่งลิงก์ให้");
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อระบบอีเมลได้");
    }
  });

  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-6 text-[var(--ink)] sm:grid sm:place-items-center sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <Link href="/"><BrandMark /></Link>
          <Link href="/login" className="text-xs font-black text-[var(--gold-strong)]">กลับไปเข้าสู่ระบบ</Link>
        </div>
        <Card className="mt-8 rounded-[28px]">
          <CardHeader className="pb-4 sm:p-8 sm:pb-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold-strong)]"><ShieldCheckIcon size={22} /></div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.045em]">ลืมรหัสผ่าน</h1>
            <p className="text-sm leading-6 text-[var(--muted)]">กรอกอีเมลของบัญชี เราจะส่งลิงก์แบบใช้ครั้งเดียวสำหรับตั้งรหัสผ่านใหม่</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-8 sm:pb-8">
            <form onSubmit={submit} className="space-y-4" noValidate>
              <FormField>
                <FormLabel htmlFor="forgot-email">อีเมล</FormLabel>
                <Input id="forgot-email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} {...register("email")} />
                <FormMessage>{errors.email?.message}</FormMessage>
              </FormField>
              {message && <p role="status" className={`rounded-xl border p-3 text-sm font-semibold ${done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{message}</p>}
              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "กำลังส่ง..." : <>ส่งลิงก์ตั้งรหัสผ่าน<ArrowRightIcon size={17} /></>}
              </Button>
            </form>
            <p className="mt-5 text-xs leading-5 text-[var(--muted)]">เพื่อความปลอดภัย ระบบจะแสดงข้อความเหมือนกันไม่ว่าอีเมลนั้นจะมีบัญชีหรือไม่</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
