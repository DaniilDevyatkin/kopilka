import "server-only";

const foundationStatus = Object.freeze({
  rendering: "React Server Components",
  typeScript: "strict",
  dataLayer: "Prisma/PostgreSQL scaffold",
});

export function getFoundationStatus() {
  return foundationStatus;
}
