import type { Metadata } from "next";

import { AccountList } from "@/features/accounts/account-list";
import { toClientAccount } from "@/lib/accounts/dto";
import { accountService } from "@/server/accounts";
import { guardPrivateRoute } from "@/server/auth/route-guards";

export const metadata: Metadata = { title: "Счета — Копилка" };

export default async function AccountsPage() {
  const user = await guardPrivateRoute();
  const accounts = await accountService.listAccounts(user.id);
  return <AccountList initialAccounts={accounts.map(toClientAccount)} />;
}
