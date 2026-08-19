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
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/forms/auth";

export default function ResetPasswordPage() {
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const submit = handleSubmit(async (values) => {
    setMessage("");
    const token = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
    if (!token) {
      setMessage("ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง กรุณาขอลิงก์ใหม่");
      return;
    }
    try {
      const parsed = resetPasswordSchema.parse(values);
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: parsed.password }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "ไม่สามารถตั้งรหัสผ่านใหม่ได้");
        return;
      }
      setDone(true);
      setMessage(result.message ?? "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว");
      reset();
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อระบบตั้งรหัสผ่านได้");
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
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold-strong)]"><ShieldCheckIcon size={22} /></div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.045em]">ตั้งรหัสผ่านใหม่</h1>
            <p className="text-sm leading-6 text-[var(--muted)]">ลิงก์นี้ใช้ได้ครั้งเดียว เมื่อเปลี่ยนสำเร็จ session เดิมทั้งหมดจะถูกออกจากระบบ</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-8 sm:pb-8">
            {done ? (
              <div className="space-y-4">
                <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>
                <Link href="/login" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-black text-white">เข้าสู่ระบบด้วยรหัสใหม่<ArrowRightIcon size={17} /></Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4" noValidate>
                <FormField>
                  <FormLabel htmlFor="reset-password">รหัสผ่านใหม่</FormLabel>
                  <Input id="reset-password" type="password" autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" aria-invalid={Boolean(errors.password)} {...register("password")} />
                  <FormMessage>{errors.password?.message}</FormMessage>
                </FormField>
                <FormField>
                  <FormLabel htmlFor="reset-password-confirm">ยืนยันรหัสผ่านใหม่</FormLabel>
                  <Input id="reset-password-confirm" type="password" autoComplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
                  <FormMessage>{errors.confirmPassword?.message}</FormMessage>
                </FormField>
                {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}
                <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "กำลังบันทึก..." : <>ตั้งรหัสผ่านใหม่<ArrowRightIcon size={17} /></>}
                </Button>
                <p className="text-center text-xs text-[var(--muted)]"><Link href="/forgot-password" className="font-black underline underline-offset-4">ขอลิงก์ตั้งรหัสผ่านใหม่</Link></p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
