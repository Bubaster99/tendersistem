// Права снабженца (решение владельца): только тендеры и просмотр подрядчиков.
// Объекты, контакты, виды работ, сотрудники, статус подрядчика, выбор победителя — только администратор.
// Оценку и комментарий о подрядчике оставляет любой сотрудник.
// Проверяем сами серверные действия: даже вызванные напрямую, они отказывают снабженцу.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Права снабженца и администратора", async () => {
  const session = await import("@/lib/session");
  const getCurrentUser = vi.mocked(session.getCurrentUser);
  const projects = await import("@/app/admin/(panel)/projects/actions");
  const contacts = await import("@/app/admin/(panel)/contacts/actions");
  const workTypes = await import("@/app/admin/(panel)/work-types/actions");
  const staff = await import("@/app/admin/(panel)/staff/actions");
  const companyActions = await import("@/app/admin/(panel)/companies/actions");
  const award = await import("@/app/admin/(panel)/tenders/[id]/award-actions");

  const as = (role: "buyer" | "admin" | "contractor") =>
    getCurrentUser.mockResolvedValue({ id: `u-${role}`, email: `${role}@roles.ru`, role, companyId: null, company: null } as never);

  const fd = (o: Record<string, string> = {}) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };

  const adminOnly: [string, () => Promise<unknown>][] = [
    ["создать объект", () => projects.saveProject(null, fd({ name: "Объект" }))],
    ["удалить объект", () => projects.deleteProject("x")],
    ["создать контакт", () => contacts.saveContact(null, fd({ name: "Контакт" }))],
    ["удалить контакт", () => contacts.deleteContact("x")],
    ["добавить вид работ", () => workTypes.saveWorkType(null, fd({ name: "Вид" }))],
    ["удалить вид работ", () => workTypes.deleteWorkType("x")],
    ["добавить сотрудника", () => staff.addStaffAction(fd({ email: "x@roles.ru", role: "admin" }))],
    ["удалить сотрудника", () => staff.removeStaffAction("x")],
    ["статус подрядчика", () => companyActions.updateCompanyAction("x", fd({ status: "blocked" }))],
    ["выбрать победителя", () => award.chooseWinnerAction("x", fd({ winner: "x" }))],
  ];

  beforeEach(() => getCurrentUser.mockReset());

  for (const [name, call] of adminOnly) {
    it(`снабженцу и подрядчику нельзя: ${name}`, async () => {
      as("buyer");
      await expect(call()).rejects.toThrow("Нет доступа");
      as("contractor");
      await expect(call()).rejects.toThrow("Нет доступа");
      getCurrentUser.mockResolvedValue(null);
      await expect(call()).rejects.toThrow("Нет доступа");
    });
  }

  it("оценку и комментарий о подрядчике снабженец оставить может, подрядчик — нет", async () => {
    as("contractor");
    await expect(companyActions.addCompanyNoteAction("x", fd({ rating: "5" }))).rejects.toThrow("Нет доступа");
    as("buyer");
    await expect(companyActions.addCompanyNoteAction("нет-такого", fd({ rating: "5" }))).resolves.toEqual({ error: "Компания не найдена" });
  });

  it("администратору проверка прав не мешает (дальше — обычные проверки данных)", async () => {
    as("admin");
    await expect(projects.deleteProject("нет-такого")).resolves.toMatchObject({ error: expect.any(String) });
    await expect(contacts.deleteContact("нет-такого")).resolves.toMatchObject({ error: expect.any(String) });
  });
});
