"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          padding: "2rem",
          fontFamily: "system-ui",
          background: "#0d1513",
          color: "#f5f4ed",
        }}
      >
        <main>
          <h1>Копилка не смогла открыть страницу</h1>
          <p>Данные сохранены. Попробуйте загрузить приложение ещё раз.</p>
          <button type="button" onClick={reset}>
            Повторить
          </button>
        </main>
      </body>
    </html>
  );
}
