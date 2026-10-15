import "server-only";
// Задачи по расписанию — раз в минуту внутри самого сайта, отдельный сервис не нужен.
import { sendBidsOpenedNotices, sendDeadlineReminders, sendTenderOpenedNotices } from "./notify";

const EVERY_MS = 60 * 1000;

/** Один проход: закрыть истёкшие тендеры и письмо «КП вскрыты», рассылка о старте приёма, напоминания за 2 дня. */
export async function runScheduledJobs(now: Date = new Date()): Promise<void> {
  for (const job of [sendBidsOpenedNotices, sendTenderOpenedNotices, sendDeadlineReminders]) {
    try {
      await job(now);
    } catch (e) {
      console.error("Ошибка задачи по расписанию:", e);
    }
  }
}

const g = globalThis as unknown as { tenderScheduler?: NodeJS.Timeout };

export function startScheduler(): void {
  if (g.tenderScheduler) return; // в режиме разработки файл может загрузиться повторно — второй таймер не нужен
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runScheduledJobs();
    } finally {
      running = false;
    }
  };
  g.tenderScheduler = setInterval(tick, EVERY_MS);
  setTimeout(tick, 5000); // первый проход — сразу после запуска
  console.log("Расписание запущено: письма и дедлайны проверяются раз в минуту");
}
