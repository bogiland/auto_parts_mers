import { AccountShell } from "@/components/account/AccountShell";
import { PasswordForm } from "@/components/account/AccountForms";
import { requireCustomer } from "@/lib/customer-auth";

export const metadata = { title: "Изменить пароль — NAA.md" };

export default async function AccountPasswordPage() {
  await requireCustomer();
  return <AccountShell active="/account/password" title="Изменить пароль">
    <PasswordForm />
  </AccountShell>;
}
