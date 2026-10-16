import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Режим разработки: разрешаем открывать сайт с телефона по адресу компьютера в домашней/офисной сети.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  // Заголовки безопасности для всех страниц: сайт нельзя встроить в чужую страницу (защита от «кликджекинга»),
  // браузер не угадывает тип файлов, адрес страницы не уходит на сторонние сайты.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  experimental: {
    // Документы тендера — до 200 МБ (раздел 6 SPEC.md), плюс запас на служебные данные формы.
    serverActions: { bodySizeLimit: "201mb" },
  },
};

export default nextConfig;
