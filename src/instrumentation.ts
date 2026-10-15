// Next.js вызывает register() один раз при запуске сервера — здесь запускаем расписание.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
