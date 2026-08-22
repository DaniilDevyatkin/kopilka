import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";
import { registerAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Регистрация — Копилка" };

export default function RegisterPage() {
  return <RegisterForm action={registerAction} />;
}
