import { sendTransactionalEmail } from "@/lib/email/resend";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function actionUrl(baseUrl: string, pathname: string, token: string): string {
  const url = new URL(pathname, baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function emailFrame(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f7f5ef;font-family:Arial,sans-serif;color:#171717"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="font-size:20px;font-weight:800;margin-bottom:24px">Borow Borow</div><div style="background:#fff;border:1px solid #e8e2d5;border-radius:20px;padding:28px"><h1 style="font-size:24px;margin:0 0 14px">${title}</h1>${bodyHtml}</div><p style="font-size:12px;line-height:20px;color:#6f6a61;margin-top:18px">หากคุณไม่ได้เป็นผู้ดำเนินการนี้ คุณสามารถละเว้นอีเมลฉบับนี้ได้</p></div></body></html>`;
}

export async function sendEmailVerificationMessage(input: {
  to: string;
  displayName: string;
  token: string;
  baseUrl: string;
  actionId: string;
}): Promise<{ id: string }> {
  const url = actionUrl(input.baseUrl, "/verify-email", input.token);
  const safeName = escapeHtml(input.displayName);
  const safeUrl = escapeHtml(url);
  return sendTransactionalEmail({
    to: input.to,
    subject: "ยืนยันอีเมล Borow Borow",
    text: `สวัสดี ${input.displayName}\n\nยืนยันอีเมลของคุณที่ลิงก์นี้: ${url}\n\nลิงก์นี้ใช้ได้ครั้งเดียวและมีวันหมดอายุ`,
    html: emailFrame(
      "ยืนยันอีเมลของคุณ",
      `<p style="font-size:15px;line-height:24px">สวัสดี ${safeName} ยืนยันอีเมลเพื่อเพิ่มความปลอดภัยให้บัญชี Borow Borow ของคุณ</p><p style="margin:24px 0"><a href="${safeUrl}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:700">ยืนยันอีเมล</a></p><p style="font-size:13px;line-height:21px;color:#6f6a61">ลิงก์นี้ใช้ได้ครั้งเดียว หากปุ่มไม่ทำงานให้เปิดลิงก์นี้ในเบราว์เซอร์:<br>${safeUrl}</p>`,
    ),
    idempotencyKey: `email-verify/${input.actionId}`,
  });
}

export async function sendPasswordResetMessage(input: {
  to: string;
  displayName: string;
  token: string;
  baseUrl: string;
  actionId: string;
}): Promise<{ id: string }> {
  const url = actionUrl(input.baseUrl, "/reset-password", input.token);
  const safeName = escapeHtml(input.displayName);
  const safeUrl = escapeHtml(url);
  return sendTransactionalEmail({
    to: input.to,
    subject: "ตั้งรหัสผ่าน Borow Borow ใหม่",
    text: `สวัสดี ${input.displayName}\n\nตั้งรหัสผ่านใหม่ที่ลิงก์นี้: ${url}\n\nลิงก์นี้ใช้ได้ครั้งเดียวและมีวันหมดอายุ หากคุณไม่ได้ขอรีเซ็ตรหัสผ่านให้ละเว้นอีเมลนี้`,
    html: emailFrame(
      "ตั้งรหัสผ่านใหม่",
      `<p style="font-size:15px;line-height:24px">สวัสดี ${safeName} เราได้รับคำขอให้ตั้งรหัสผ่าน Borow Borow ใหม่</p><p style="margin:24px 0"><a href="${safeUrl}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:700">ตั้งรหัสผ่านใหม่</a></p><p style="font-size:13px;line-height:21px;color:#6f6a61">ลิงก์นี้ใช้ได้ครั้งเดียว หากคุณไม่ได้ส่งคำขอนี้ ไม่ต้องดำเนินการใด ๆ</p>`,
    ),
    idempotencyKey: `password-reset/${input.actionId}`,
  });
}

export async function sendPasswordChangedMessage(input: {
  to: string;
  displayName: string;
  actionId: string;
}): Promise<{ id: string }> {
  const safeName = escapeHtml(input.displayName);
  return sendTransactionalEmail({
    to: input.to,
    subject: "รหัสผ่าน Borow Borow ถูกเปลี่ยนแล้ว",
    text: `สวัสดี ${input.displayName}\n\nรหัสผ่านบัญชี Borow Borow ของคุณถูกเปลี่ยนแล้ว และ session เดิมถูกออกจากระบบเพื่อความปลอดภัย หากไม่ใช่คุณ โปรดติดต่อทีมงานทันที`,
    html: emailFrame(
      "รหัสผ่านถูกเปลี่ยนแล้ว",
      `<p style="font-size:15px;line-height:24px">สวัสดี ${safeName} รหัสผ่านบัญชีของคุณถูกเปลี่ยนเรียบร้อยแล้ว และ session เดิมถูกยกเลิกเพื่อความปลอดภัย</p><p style="font-size:13px;line-height:21px;color:#6f6a61">หากการเปลี่ยนแปลงนี้ไม่ใช่คุณ โปรดติดต่อทีมงาน Borow Borow ทันที</p>`,
    ),
    idempotencyKey: `password-changed/${input.actionId}`,
  });
}
