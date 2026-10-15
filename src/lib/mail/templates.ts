// Тексты всех писем раздела 7 SPEC.md. Каждая функция только собирает письмо — кому и когда его слать, решает src/lib/notify.ts.
import { formatDateTime } from "../time";
import { appUrl, renderEmail, type EmailBlock, type EmailContent } from "./layout";

export type TenderInfo = {
  id: string;
  title: string;
  projectName: string;
  workTypeName: string;
  deadlineAt: Date | null;
};

const tenderUrl = (t: { id: string }) => appUrl(`/tenders/${t.id}`);
const adminTenderUrl = (t: { id: string }) => appUrl(`/admin/tenders/${t.id}`);

function tenderFacts(t: TenderInfo, deadlineLabel = "Приём КП до"): EmailBlock {
  const rows: [string, string][] = [
    ["Объект", t.projectName],
    ["Вид работ", t.workTypeName],
  ];
  if (t.deadlineAt) rows.push([deadlineLabel, formatDateTime(t.deadlineAt)]);
  return { kind: "facts", rows };
}

// ---------- Подрядчику ----------

export function loginCodeEmail(code: string): EmailContent {
  return renderEmail({
    subject: `Код входа: ${code}`,
    title: "Код для входа",
    blocks: [{ kind: "p", text: "Введите этот код на странице входа:" }, { kind: "code", code }, { kind: "p", text: "Код действует 10 минут." }],
    footnote: "Если вы не запрашивали код — просто проигнорируйте это письмо.",
  });
}

/** Открыт приём КП: по подписке и/или по кнопке «Сообщить о старте». */
export function tenderOpenedEmail(t: TenderInfo, reason: "subscription" | "watch"): EmailContent {
  return renderEmail({
    subject: `Открыт приём КП: ${t.title}`,
    title: `Открыт приём КП: ${t.title}`,
    blocks: [
      {
        kind: "p",
        text:
          reason === "watch"
            ? "Вы просили сообщить о старте этого тендера. Приём коммерческих предложений открыт."
            : "По вашей подписке открыт приём коммерческих предложений.",
      },
      tenderFacts(t),
      { kind: "p", text: "Скачайте документацию и заполните КП по шаблону (ВОР) — его можно подать и заменить до окончания приёма." },
    ],
    button: { label: "Открыть тендер", url: tenderUrl(t) },
    footnote: reason === "subscription" ? "Изменить подписку можно на площадке — кнопка «Подписка» в верхнем меню." : undefined,
  });
}

/** Подтверждение приёма или замены КП. Сумму в письмо не пишем. */
export function bidAcceptedEmail(t: TenderInfo, bid: { fileName: string; at: Date; replaced: boolean }): EmailContent {
  const what = bid.replaced ? "КП заменено" : "КП принято";
  return renderEmail({
    subject: `${what}: ${t.title}`,
    title: what,
    blocks: [
      {
        kind: "p",
        text: bid.replaced
          ? "Мы получили новую версию вашего коммерческого предложения. Она заменила предыдущую."
          : "Мы получили ваше коммерческое предложение.",
      },
      {
        kind: "facts",
        rows: [
          ["Тендер", t.title],
          ["Объект", t.projectName],
          ["Файл", bid.fileName],
          [bid.replaced ? "Заменено" : "Подано", formatDateTime(bid.at)],
          ...(t.deadlineAt ? ([["Приём КП до", formatDateTime(t.deadlineAt)]] as [string, string][]) : []),
        ],
      },
      { kind: "p", text: "До окончания приёма КП никто не видит суммы и файлы предложений — ни другие участники, ни наши сотрудники. Заменить КП можно до этого срока." },
    ],
    button: { label: "Открыть тендер", url: tenderUrl(t) },
  });
}

/** Напоминание за 2 дня до дедлайна: скачали документацию, но КП не подали. */
export function deadlineReminderEmail(t: TenderInfo): EmailContent {
  return renderEmail({
    subject: `Осталось 2 дня: приём КП «${t.title}»`,
    title: "Приём КП скоро закончится",
    blocks: [
      { kind: "p", text: "Вы скачивали документацию по этому тендеру, но ещё не подали коммерческое предложение." },
      tenderFacts(t),
      { kind: "p", text: "После окончания срока подать КП будет нельзя." },
    ],
    button: { label: "Подать КП", url: tenderUrl(t) },
  });
}

/** Приглашение на переторжку (раунд 2). Подключается к кнопке на этапе 5. */
export function rebidInviteEmail(t: TenderInfo, rebidDeadline: Date): EmailContent {
  return renderEmail({
    subject: `Приглашение на переторжку: ${t.title}`,
    title: "Приглашение на переторжку",
    blocks: [
      { kind: "p", text: "Спасибо за ваше коммерческое предложение. Приглашаем вас к переторжке — второму раунду: вы можете подать улучшенное КП." },
      tenderFacts({ ...t, deadlineAt: rebidDeadline }, "Новое КП до"),
      { kind: "p", text: "Подайте новое КП по тому же шаблону. Если КП не будет подано, в сравнении останется ваше предложение из первого раунда." },
    ],
    button: { label: "Подать КП на переторжку", url: tenderUrl(t) },
  });
}

/** Итоги: победителю — с запросом пакета документов. Подключается на этапе 5. */
export function winnerEmail(t: TenderInfo, documents: string[], contact: { name: string; email?: string | null; phone?: string | null } | null): EmailContent {
  const blocks: EmailBlock[] = [
    { kind: "p", text: `Поздравляем! По итогам тендера «${t.title}» (${t.projectName}) выбрано ваше предложение.` },
  ];
  if (documents.length > 0) {
    blocks.push({ kind: "p", text: "Для заключения договора пришлите, пожалуйста, пакет документов:" }, { kind: "list", items: documents });
  }
  if (contact) {
    blocks.push({
      kind: "facts",
      rows: [["Контакт", contact.name], ...(contact.email ? ([["Email", contact.email]] as [string, string][]) : []), ...(contact.phone ? ([["Телефон", contact.phone]] as [string, string][]) : [])],
    });
  }
  return renderEmail({
    subject: `Итоги тендера: ваше КП выбрано — ${t.title}`,
    title: "Ваше предложение выбрано",
    blocks,
    button: { label: "Открыть тендер", url: tenderUrl(t) },
  });
}

/** Итоги: остальным участникам. Подключается на этапе 5. */
export function notSelectedEmail(t: TenderInfo): EmailContent {
  return renderEmail({
    subject: `Итоги тендера: ${t.title}`,
    title: "Итоги тендера",
    blocks: [
      { kind: "p", text: `По тендеру «${t.title}» (${t.projectName}) выбран другой участник.` },
      { kind: "p", text: "Спасибо за участие! Будем рады видеть ваши предложения в следующих тендерах." },
    ],
    button: { label: "Смотреть тендеры", url: appUrl("/tenders") },
  });
}

// ---------- Снабжению ----------

export function staffNewCompanyEmail(c: { name: string; inn: string; city: string | null; email: string }): EmailContent {
  return renderEmail({
    subject: `Новая регистрация: ${c.name}`,
    title: "Зарегистрировалась новая компания",
    blocks: [
      {
        kind: "facts",
        rows: [["Компания", c.name], ["ИНН", c.inn], ...(c.city ? ([["Город", c.city]] as [string, string][]) : []), ["Email", c.email]],
      },
    ],
    button: { label: "Открыть админку", url: appUrl("/admin") },
  });
}

/** Новое КП — без суммы и без файла: до дедлайна они запечатаны. */
export function staffNewBidEmail(t: TenderInfo, b: { companyName: string; replaced: boolean; count: number }): EmailContent {
  return renderEmail({
    subject: `${b.replaced ? "Замена КП" : "Новое КП"}: ${t.title}`,
    title: b.replaced ? "Участник заменил КП" : "Поступило новое КП",
    blocks: [
      {
        kind: "facts",
        rows: [
          ["Тендер", t.title],
          ["Объект", t.projectName],
          ["Участник", b.companyName],
          ["Всего КП", String(b.count)],
          ...(t.deadlineAt ? ([["Вскрытие КП", formatDateTime(t.deadlineAt)]] as [string, string][]) : []),
        ],
      },
      { kind: "p", text: "Сумма и файл КП станут доступны после окончания приёма." },
    ],
    button: { label: "Открыть тендер в админке", url: adminTenderUrl(t) },
  });
}

export function staffBidsOpenedEmail(t: TenderInfo, count: number): EmailContent {
  return renderEmail({
    subject: `КП вскрыты: ${t.title}`,
    title: "Приём КП завершён — КП вскрыты",
    blocks: [
      {
        kind: "facts",
        rows: [
          ["Тендер", t.title],
          ["Объект", t.projectName],
          ["Вид работ", t.workTypeName],
          ["Подано КП", String(count)],
        ],
      },
      { kind: "p", text: count > 0 ? "Суммы и файлы КП теперь доступны в карточке тендера." : "По тендеру не подано ни одного КП." },
    ],
    button: { label: "Открыть тендер в админке", url: adminTenderUrl(t) },
  });
}
