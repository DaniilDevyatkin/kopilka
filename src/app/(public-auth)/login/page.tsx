import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { loginAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Вход — Копилка" };

export default function LoginPage() {
  return <LoginForm action={loginAction} />;
}
