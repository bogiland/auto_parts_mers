import { cookies } from "next/headers";
import { customerCookie, customerCookieOptions } from "@/lib/customer-auth";
import {
  AccountError, changePassword, customerBySession, deleteAddress, listAddresses, loginCustomer,
  logoutCustomer, registerCustomer, saveAddress, setDefaultAddress, updateProfile,
} from "@/lib/customer-db";
import { sameOrigin } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new Response(null, { status: 400 });
  const jar = await cookies();
  const token = jar.get(customerCookie)?.value;
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

  try {
    if (body.action === "register") {
      const { customer, token: fresh } = (await registerCustomer(body));
      jar.set(customerCookie, fresh, customerCookieOptions);
      return json({ ok: true, customer });
    }
    if (body.action === "login") {
      const result = (await loginCustomer(String(body.login ?? ""), String(body.password ?? "")));
      // Один и тот же ответ на неизвестную почту и на неверный пароль: так не узнать, кто у нас есть.
      if (!result) return json({ field: "password", message: "Неверная почта, телефон или пароль." }, 401);
      jar.set(customerCookie, result.token, customerCookieOptions);
      return json({ ok: true, customer: result.customer });
    }
    if (body.action === "logout") {
      (await logoutCustomer(token, body.everywhere === true));
      jar.delete(customerCookie);
      return json({ ok: true });
    }

    const customer = (await customerBySession(token));
    if (!customer) return json({ message: "Войдите в кабинет." }, 401);

    switch (body.action) {
      case "profile": (await updateProfile(customer, body)); return json({ ok: true });
      case "password": {
        (await changePassword(customer, body.current, body.password));
        jar.delete(customerCookie);
        return json({ ok: true, loggedOut: true });
      }
      case "save-address": return json({ ok: true, id: (await saveAddress(customer, body)), addresses: (await listAddresses(customer.id)) });
      case "default-address": (await setDefaultAddress(customer, Number(body.id))); return json({ ok: true, addresses: (await listAddresses(customer.id)) });
      case "delete-address": (await deleteAddress(customer, Number(body.id))); return json({ ok: true, addresses: (await listAddresses(customer.id)) });
      default: return new Response(null, { status: 400 });
    }
  } catch (error) {
    if (error instanceof AccountError) return json({ field: error.field, message: error.message }, 400);
    console.error("Account request failed", error);
    return json({ message: "Не удалось выполнить. Попробуйте снова." }, 500);
  }
}
