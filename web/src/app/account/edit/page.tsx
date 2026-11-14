import { AccountShell } from "@/components/account/AccountShell";
import { ProfileForm } from "@/components/account/AccountForms";
import { requireCustomer } from "@/lib/customer-auth";

export const metadata = { title: "Информация о моём аккаунте — NAA.md" };

export default async function AccountEditPage() {
  const customer = await requireCustomer();
  return <AccountShell active="/account/edit" title="Информация о моём аккаунте">
    <ProfileForm customer={customer} />
  </AccountShell>;
}
