// Поиск организации по ИНН через DaData «Подсказки по организациям».
// Если ключа нет в .env — возвращаем тестовые данные, чтобы можно было работать без DaData.

export type CompanyInfo = {
  inn: string;
  kpp: string | null;
  ogrn: string | null;
  name: string;
  address: string | null;
  city: string | null;
};

const DADATA_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party";

export async function findCompanyByInn(inn: string): Promise<CompanyInfo | null> {
  const key = process.env.DADATA_API_KEY;
  if (!key) return stubCompany(inn);

  const res = await fetch(DADATA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Token ${key}`,
    },
    body: JSON.stringify({ query: inn, count: 1 }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`DaData ответила ошибкой ${res.status}`);

  const json = (await res.json()) as { suggestions?: Array<{ value: string; data: any }> };
  const s = json.suggestions?.[0];
  if (!s) return null;
  const d = s.data ?? {};
  return {
    inn: d.inn ?? inn,
    kpp: d.kpp ?? null,
    ogrn: d.ogrn ?? null,
    name: d.name?.short_with_opf ?? s.value,
    address: d.address?.value ?? null,
    city: d.address?.data?.city ?? d.address?.data?.settlement ?? null,
  };
}

/** Тестовые данные: для любого корректного ИНН выдаём «компанию». ИНН 0000000000 — «не найдено». */
export function stubCompany(inn: string): CompanyInfo | null {
  if (/^0+$/.test(inn)) return null;
  const isIp = inn.length === 12;
  return {
    inn,
    kpp: isIp ? null : `${inn.slice(0, 4)}01001`,
    ogrn: isIp ? `3${inn.slice(0, 12)}01` : `1${inn.slice(0, 10)}12`,
    name: isIp ? `ИП Тестовый ${inn.slice(-4)}` : `ООО «Тестстрой ${inn.slice(-4)}»`,
    address: "г. Москва, ул. Тестовая, д. 1",
    city: "Москва",
  };
}
