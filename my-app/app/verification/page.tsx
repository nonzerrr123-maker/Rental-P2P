"use client";

import { useState } from "react";

export default function VerificationPage() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16 text-black">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-8 shadow-sm md:p-10">
        <p className="text-sm font-bold tracking-[3px] text-[#B08D18]">TRUST & SAFETY</p>
        <h1 className="mt-3 text-3xl font-black">ยืนยันตัวตน</h1>
        <p className="mt-3 leading-7 text-gray-500">เพื่อความปลอดภัยของผู้ให้ยืมและผู้ยืม คุณต้องยืนยันตัวตนก่อนลงของให้ยืมหรือส่งคำขอยืม</p>

        <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
          <div className={`rounded-lg border p-4 ${step >= 1 ? "border-[#D4AF37] bg-[#fffaf0]" : ""}`}><b>01</b><p className="mt-1">ยืนยันบัตรประชาชน</p></div>
          <div className={`rounded-lg border p-4 ${step >= 2 ? "border-[#D4AF37] bg-[#fffaf0]" : ""}`}><b>02</b><p className="mt-1">ยืนยันใบหน้า</p></div>
        </div>

        {!submitted ? (
          <section className="mt-8 rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
            {step === 1 ? (
              <>
                <div className="text-5xl">🪪</div>
                <h2 className="mt-4 text-xl font-bold">เตรียมบัตรประชาชน</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">ขั้นตอนนี้เป็น UX placeholder เท่านั้น การใช้งานจริงควรเชื่อมผู้ให้บริการ KYC ที่รองรับ OCR และตรวจสอบเอกสารอย่างปลอดภัย</p>
                <button onClick={() => setStep(2)} className="mt-6 rounded-lg bg-black px-6 py-3 font-bold text-white">ดำเนินการต่อ</button>
              </>
            ) : (
              <>
                <div className="text-5xl">🙂</div>
                <h2 className="mt-4 text-xl font-bold">เตรียมกล้องสำหรับยืนยันใบหน้า</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">ขั้นตอนจริงควรใช้ liveness detection และ face matching ผ่านผู้ให้บริการที่เหมาะสม ห้ามนำรูปหรือข้อมูลชีวมิติไปเก็บในฐานข้อมูลแอปโดยตรง</p>
                <button onClick={() => setSubmitted(true)} className="mt-6 rounded-lg bg-[#D4AF37] px-6 py-3 font-bold text-black">ส่งคำขอยืนยัน</button>
              </>
            )}
          </section>
        ) : (
          <section className="mt-8 rounded-xl border border-[#D4AF37] bg-[#fffaf0] p-8 text-center">
            <div className="text-5xl">⏳</div>
            <h2 className="mt-4 text-xl font-bold">ส่งคำขอแล้ว</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">สถานะของคุณคือ <b>PENDING</b> ระบบจะแจ้งผลเมื่อการตรวจสอบเสร็จสิ้น</p>
          </section>
        )}

        <div className="mt-8 rounded-lg bg-gray-50 p-4 text-xs leading-6 text-gray-500">ความเป็นส่วนตัว: ข้อมูลบัตรประชาชนและข้อมูลใบหน้ามีความอ่อนไหวสูง ระบบจริงควรเก็บเท่าที่จำเป็น ใช้การเข้ารหัส จำกัดสิทธิ์การเข้าถึง กำหนดระยะเวลาการเก็บรักษา และแจ้งรายละเอียดการประมวลผลข้อมูลให้ผู้ใช้ทราบก่อนให้ความยินยอม</div>
      </div>
    </main>
  );
}
