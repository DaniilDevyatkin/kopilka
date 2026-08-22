import type { MetadataRoute } from "next";

type ExtendedManifest = MetadataRoute.Manifest & {
  display_override: string[];
  prefer_related_applications: boolean;
  screenshots: Array<{
    src: string;
    sizes: string;
    type: string;
    form_factor: "narrow" | "wide";
    label: string;
  }>;
};

export default function manifest(): ExtendedManifest {
  return {
    id: "/app",
    name: "Копилка — личные финансы",
    short_name: "Копилка",
    description:
      "Спокойный инструмент для счетов, операций, накоплений и финансовых целей.",
    start_url: "/app/home",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#0d1513",
    theme_color: "#0d1513",
    prefer_related_applications: false,
    lang: "ru",
    dir: "ltr",
    orientation: "portrait-primary",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/pwa/screenshot-home.jpg",
        sizes: "375x812",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "Главная Копилки с балансом, картой и быстрыми действиями",
      },
    ],
    shortcuts: [
      {
        name: "Добавить доход или расход",
        short_name: "Добавить",
        description: "Открыть быстрые финансовые действия",
        url: "/app/home?action=new",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Мои хотелки",
        short_name: "Хотелки",
        description: "Открыть финансовые цели",
        url: "/app/goals",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
