import { isValidPhoneNumber } from "libphonenumber-js";
import { createOrder, OrderError, type OrderInput } from "@/lib/checkout-db";
import { currentCustomer } from "@/lib/customer-auth";
import { attachOrderToCustomer } from "@/lib/customer-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let input: OrderInput;
  try { input = await request.json() as OrderInput; } catch { return Response.json({ field: "items", message: "Не удалось прочитать заказ." }, { status: 400 }); }
  if (!input || typeof input !== "object") return Response.json({ field: "items", message: "Проверьте заказ." }, { status: 400 });
  const invalid = (field: string, message: string) => Response.json({ field, message }, { status: 400 });
  if (typeof input.key !== "string" || !/^[a-f0-9-]{36}$/i.test(input.key)) return invalid("items", "Обновите страницу и повторите.");
  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.length > 100) return invalid("name", "Укажите имя.");
  if (typeof input.phone !== "string" || !isValidPhoneNumber(input.phone)) return invalid("phone", "Проверьте номер телефона.");
  if (!["call", "viber", "telegram"].includes(input.contactMethod)) return invalid("contactMethod", "Выберите способ связи.");
  if (typeof input.address !== "string" || input.address.length > 500) return invalid("address", "Проверьте адрес.");
  if (typeof input.comment !== "string" || input.comment.length > 2000) return invalid("comment", "Комментарий слишком длинный.");
  if (!Array.isArray(input.items)) return invalid("items", "Проверьте состав корзины.");
  try {
    const order = createOrder(input);
    // Заказ вошедшего покупателя сразу виден в его истории заказов.
    const customer = await currentCustomer();
    if (customer) attachOrderToCustomer(order.number - 1000, customer.id);
    return Response.json(order, { status: 201, headers: { "Cache-Control": "no-store" } });
  }
  catch (error) {
    if (error instanceof OrderError) return Response.json({ field: error.field, message: error.message }, { status: error.status });
    console.error("Order creation failed", error);
    return Response.json({ field: "submit", message: "Не удалось отправить заказ. Повторите попытку." }, { status: 500 });
  }
}
