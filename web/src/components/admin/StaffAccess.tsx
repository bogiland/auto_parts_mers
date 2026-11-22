"use client";
// Выдача доступа в админку: находим человека среди зарегистрированных на сайте и назначаем роль.
// Отдельный пароль ему не нужен — в админку он входит тем же, чем в свой кабинет.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, ShieldCheck, UserRound } from "lucide-react";
import { staffCall } from "@/components/admin/staff-client";

type Person = { id: number; name: string; email: string; phone: string; role: "owner" | "operator" | null };
const roleLabel = (role: string | null) => (role === "owner" ? "владелец" : role === "operator" ? "оператор" : "");

export function StaffAccess() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function find() {
    if (query.trim().length < 1) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await staffCall<{ people: Person[] }>("action", { action: "find-people", query });
      setPeople(data.people ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось найти");
    } finally {
      setBusy(false);
    }
  }

  async function grant(person: Person, role: "owner" | "operator") {
    if (!window.confirm(`Дать ${person.name} доступ в админку как ${roleLabel(role)}?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await staffCall("action", { action: "grant-staff", customerId: person.id, role });
      setNotice(`${person.name} теперь ${roleLabel(role)}. Входит по своему телефону и паролю от кабинета.`);
      setPeople((current) => current?.map((item) => (item.id === person.id ? { ...item, role } : item)) ?? null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось выдать доступ");
    } finally {
      setBusy(false);
    }
  }

  return <div className="admin-card">
    <h2>Выдать доступ зарегистрированному человеку</h2>
    <p className="admin-muted">Найдите его по номеру клиента, имени, фамилии, почте или телефону — и назначьте роль. Отдельный пароль не нужен: в админку он войдёт тем же, чем заходит в свой кабинет на сайте.</p>
    <form className="admin-table-tools" onSubmit={async (event) => { event.preventDefault(); void (await find()); }}>
      <input aria-label="Поиск человека" onChange={(event) => setQuery(event.target.value)} placeholder="Номер клиента, имя, почта или телефон" value={query} />
      <button className="admin-button" disabled={busy || !query.trim()} type="submit"><Search size={16} />Найти</button>
    </form>
    {notice && <p className="admin-success" role="status">{notice}</p>}
    {error && <p className="admin-error" role="alert">{error}</p>}

    {people && <div className="admin-list">
      {people.map((person) => <div className="admin-card admin-row admin-sub-card" key={person.id}>
        <span className="admin-avatar">{person.name.slice(0, 1).toUpperCase() || "?"}</span>
        <div className="admin-tree-name">
          <strong>{person.name}</strong>
          <small className="admin-muted">№ {person.id} · {person.phone}{person.email ? ` · ${person.email}` : ""}</small>
        </div>
        {person.role
          ? <span className="admin-chip" data-status="issued"><ShieldCheck size={12} /> {roleLabel(person.role)}</span>
          : <span className="admin-chip"><UserRound size={12} /> покупатель</span>}
        <div className="admin-tree-actions">
          <button className="admin-ghost-button" disabled={busy || person.role === "operator"} onClick={async () => void (await grant(person, "operator"))} type="button">Оператор</button>
          <button className="admin-ghost-button" disabled={busy || person.role === "owner"} onClick={async () => void (await grant(person, "owner"))} type="button">Владелец</button>
        </div>
      </div>)}
      {!people.length && <p className="admin-muted">Никого не нашли. Человек должен сначала зарегистрироваться на сайте — тогда у него появится номер клиента.</p>}
    </div>}

    <p className="admin-note">Оператор видит заказы, заявки, детали, доноров и возвраты. Владелец — всё, включая справочники, деньги, страницы сайта и этот раздел. Чтобы забрать доступ, удалите человека в списке сотрудников ниже: его кабинет покупателя при этом сохраняется.</p>
  </div>;
}
