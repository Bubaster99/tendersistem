// Next.js вызывает register() один раз при запуске сервера.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV === "production") {
    const { productionConfigProblems } = await import("./lib/startup-checks");
    const problems = productionConfigProblems();
    if (problems.length) {
      // Не запускаемся с небезопасными настройками — понятное сообщение в журнале контейнера.
      console.error(`\nРабочий сервер не запущен: исправьте .env\n- ${problems.join("\n- ")}\n`);
      process.exit(1);
    }
  }
  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
}
