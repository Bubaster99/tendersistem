import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Режим разработки: разрешаем открывать сайт с телефона по адресу компьютера в домашней/офисной сети.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  experimental: {
    // Документы тендера — до 200 МБ (раздел 6 SPEC.md), плюс запас на служебные данные формы.
    serverActions: { bodySizeLimit: "201mb" },
  },
};

export default nextConfig;
