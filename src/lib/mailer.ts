import nodemailer from "nodemailer";

type Mail = { to: string; subject: string; text: string; html?: string };

/**
 * Отправка письма. В режиме разработки (или если SMTP не настроен) письмо
 * не отправляется, а печатается в консоль.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (process.env.NODE_ENV !== "production" || !host) {
    console.log(
      `\n===== ПИСЬМО (не отправлено, режим разработки) =====\nКому: ${mail.to}\nТема: ${mail.subject}\n\n${mail.text}\n====================================================\n`,
    );
    return;
  }
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await transport.sendMail({ from: process.env.SMTP_FROM, ...mail });
}
