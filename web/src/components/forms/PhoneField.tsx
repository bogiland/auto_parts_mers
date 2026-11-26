"use client";

// Клиентский компонент: поле телефона с выбором страны для обычных форм на FormData.
import { useState } from "react";

import { PhoneInput } from "@/components/forms/PhoneInput";

/**
 * Телефон в одном формате во всех формах: страна (+373 по умолчанию) и номер.
 * В форму уходит скрытое поле `phone` уже в международном виде, поэтому формы,
 * которые собирают данные через FormData, менять не нужно.
 */
export function PhoneField({ name = "phone", showError = false }: { name?: string; showError?: boolean }) {
  const [value, setValue] = useState("");
  return <>
    <PhoneInput onValueChange={(next) => setValue(next)} showError={showError} />
    <input name={name} type="hidden" value={value} />
  </>;
}
