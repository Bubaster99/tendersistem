import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";

export type Mail = { to: string; subject: string; text: string; html?: string };

/** В тестах письма не печатаются, а складываются сюда — тесты проверяют, кому и что ушло. */
export const testOutbox: Mail[] = [];

let transport: Transporter | null = null;
function smtp(): Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      pool: true, // одно соединение на всю рассылку
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return transport;
}

/** Копия письма в папке mail-preview/ — открыть в браузере и посмотреть, как оно выглядит. */
async function savePreview(mail: Mail): Promise<string | null> {
  if (!mail.html) return null;
  const dir = path.join(process.cwd(), "mail-preview");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `${stamp}_${mail.to.replace(/[^a-z0-9@._-]/gi, "_")}_${mail.subject.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "_").slice(0, 60)}.html`;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), mail.html);
    return `mail-preview/${name}`;
  } catch {
    return null;
  }
}

/**
 * Отправка письма. В режиме разработки (или если SMTP не настроен) письмо
 * не отправляется, а печатается в консоль и сохраняется в mail-preview/.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    testOutbox.push(mail);
    return;
  }
  if (process.env.NODE_ENV !== "production" || !process.env.SMTP_HOST) {
    const file = await savePreview(mail);
    console.log(
      `\n===== ПИСЬМО (не отправлено, режим разработки) =====\nКому: ${mail.to}\nТема: ${mail.subject}\n\n${mail.text}\n${file ? `\nКак выглядит: ${file}\n` : ""}====================================================\n`,
    );
    return;
  }
  await smtp().sendMail({ from: process.env.SMTP_FROM, ...mail });
}

/** Для уведомлений: ошибка почты не должна ломать подачу КП или вход — пишем её в лог и идём дальше. */
export async function sendMailSafe(mail: Mail): Promise<boolean> {
  try {
    await sendMail(mail);
    return true;
  } catch (e) {
    console.error(`Письмо не отправлено (${mail.to}, «${mail.subject}»):`, e);
    return false;
  }
}
