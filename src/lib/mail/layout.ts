// Общий вид всех писем: шапка с логотипом, белая карточка, кнопка-ссылка, подпись.
// Вёрстка таблицами и встроенными стилями — так письмо одинаково выглядит в Яндекс, Mail.ru, Outlook и на телефоне.
// Цвета — раздел 10 SPEC.md. Логотип текстовый: картинки в письмах часто блокируются.

export type EmailContent = { subject: string; html: string; text: string };

export type EmailBlock =
  | { kind: "p"; text: string } // абзац
  | { kind: "facts"; rows: [string, string][] } // таблица «название — значение»
  | { kind: "list"; items: string[] } // список с точками
  | { kind: "code"; code: string }; // крупный код входа

export type EmailInput = {
  subject: string;
  title: string;
  blocks: EmailBlock[];
  button?: { label: string; url: string };
  footnote?: string; // мелкий текст под карточкой
};

const C = {
  bg: "#F3F1EC",
  card: "#FFFFFF",
  line: "#E2DED6",
  ink: "#1A1C1E",
  muted: "#5B5F63",
  accent: "#A63B0C",
  accentSoft: "#F6E6DC",
};
const FONT = "Onest, 'Segoe UI', Roboto, Arial, sans-serif";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Адрес площадки для ссылок в письмах. */
export function appUrl(path = ""): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

function blockHtml(b: EmailBlock): string {
  switch (b.kind) {
    case "p":
      return `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${C.ink};">${esc(b.text).replace(/\n/g, "<br>")}</p>`;
    case "facts":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;border-collapse:collapse;">${b.rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 12px 8px 0;border-top:1px solid ${C.line};font-size:14px;color:${C.muted};vertical-align:top;width:40%;">${esc(k)}</td><td style="padding:8px 0;border-top:1px solid ${C.line};font-size:14px;color:${C.ink};vertical-align:top;">${esc(v)}</td></tr>`,
        )
        .join("")}</table>`;
    case "list":
      return `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.55;color:${C.ink};">${b.items
        .map((i) => `<li style="margin:0 0 4px;">${esc(i)}</li>`)
        .join("")}</ul>`;
    case "code":
      return `<p style="margin:4px 0 18px;padding:14px 0;border-radius:12px;background:${C.accentSoft};text-align:center;font-size:30px;letter-spacing:8px;font-weight:700;color:${C.accent};">${esc(b.code)}</p>`;
  }
}

function blockText(b: EmailBlock): string {
  switch (b.kind) {
    case "p":
      return b.text;
    case "facts":
      return b.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    case "list":
      return b.items.map((i) => `— ${i}`).join("\n");
    case "code":
      return b.code;
  }
}

export function renderEmail(input: EmailInput): EmailContent {
  const button = input.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:10px;background:${C.accent};"><a href="${esc(input.button.url)}" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">${esc(input.button.label)}</a></td></tr></table>`
    : "";
  const footnote = input.footnote
    ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${C.muted};">${esc(input.footnote)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;height:36px;border-radius:10px;background:${C.accent};color:#FFFFFF;font-weight:700;font-size:15px;text-align:center;vertical-align:middle;">Т</td>
<td style="padding-left:10px;font-size:15px;font-weight:600;color:${C.ink};">Тендерная площадка</td>
</tr></table>
</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:16px;padding:28px 24px;">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:700;color:${C.ink};">${esc(input.title)}</h1>
${input.blocks.map(blockHtml).join("\n")}
${button}
</td></tr>
<tr><td style="padding:16px 4px 0;">
${footnote}
<p style="margin:0;font-size:12px;line-height:1.5;color:${C.muted};">Письмо отправлено автоматически, отвечать на него не нужно. <a href="${esc(appUrl("/"))}" style="color:${C.muted};">Тендерная площадка</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    input.title,
    "",
    ...input.blocks.map((b) => `${blockText(b)}\n`),
    ...(input.button ? [`${input.button.label}: ${input.button.url}`, ""] : []),
    ...(input.footnote ? [input.footnote, ""] : []),
    "—",
    "Тендерная площадка. Письмо отправлено автоматически, отвечать на него не нужно.",
  ].join("\n");

  return { subject: input.subject, html, text };
}
