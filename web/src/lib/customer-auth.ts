import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { customerBySession, type Customer } from "@/lib/customer-db";

// Кабинет покупателя и вход сотрудников — разные куки: вход в одно не даёт доступа к другому.
export const customerCookie = "naa_customer_session";
export const customerCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 24 * 60 * 60,
};

export async function currentCustomer(): Promise<Customer | null> {
  return customerBySession((await cookies()).get(customerCookie)?.value);
}

export async function requireCustomer(): Promise<Customer> {
  const customer = await currentCustomer();
  if (!customer) redirect("/login?next=/account");
  return customer;
}
