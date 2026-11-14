import { AccountShell } from "@/components/account/AccountShell";
import { AddressBook } from "@/components/account/AccountForms";
import { requireCustomer } from "@/lib/customer-auth";
import { listAddresses } from "@/lib/customer-db";

export const metadata = { title: "Мои адреса — NAA.md" };

export default async function AccountAddressesPage() {
  const customer = await requireCustomer();
  return <AccountShell active="/account/addresses" title="Мои адреса">
    <AddressBook initial={listAddresses(customer.id)} />
  </AccountShell>;
}
