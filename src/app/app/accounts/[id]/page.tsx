import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccountDetail } from "@/features/accounts/account-detail";
import { toClientAccountDetail } from "@/lib/accounts/dto";
import { AccountError } from "@/server/accounts/errors";
import { accountService } from "@/server/accounts/index";
import { guardPrivateRoute } from "@/server/auth/route-guards";

export const metadata: Metadata = { title: "Счёт — Копилка" };

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await guardPrivateRoute();
  let detail;

  try {
    detail = await accountService.getAccountDetail(user.id, id);
  } catch (error) {
    if (error instanceof AccountError && error.code === "ACCOUNT_NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <AccountDetail
      accountId={id}
      initialDetail={toClientAccountDetail(detail)}
    />
  );
}
