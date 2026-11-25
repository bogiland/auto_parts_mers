"use client";
// Название детали складывается на лету из справочника, поэтому форма живёт в браузере.

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CategoryNode, PartType, VehicleMake } from "@/lib/reference-db";

const sides = [{ id: "left", label: "Левая" }, { id: "right", label: "Правая" }];
const positions = [{ id: "front", label: "Передняя" }, { id: "rear", label: "Задняя" }];

export function AddPartForm({ types, categories, makes, brands = [], defaultOpen }: { types: PartType[]; categories: CategoryNode[]; makes: VehicleMake[]; brands?: { id: string; name: string }[]; defaultOpen: boolean }) {
  const router = useRouter();
  const [typeId, setTypeId] = useState("");
  const [side, setSide] = useState("");
  const [position, setPosition] = useState("");
  const [nameExtra, setNameExtra] = useState("");
  const [manualName, setManualName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  // Бренд детали — производитель, а не машина-донор: это разные поля.
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [restricted, setRestricted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const type = types.find((item) => item.id === typeId) ?? null;
  const preview = useMemo(() => {
    if (!type) return manualName.trim();
    const sideLabel = type.hasSide ? sides.find((item) => item.id === side)?.label.toLowerCase() ?? "" : "";
    const positionLabel = type.hasPosition ? positions.find((item) => item.id === position)?.label.toLowerCase() ?? "" : "";
    return [type.nameRu, sideLabel, positionLabel, nameExtra.trim()].filter(Boolean).join(" ");
  }, [manualName, nameExtra, position, side, type]);
  const place = categoryId || type?.categoryId || "";
  const noReturn = type?.returnRestricted || restricted;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setDone("");
    try {
      const response = await fetch("/api/staff/action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-product", partTypeId: typeId || undefined, name: type ? undefined : manualName.trim(), nameExtra, side, position, categoryId: place, brandId: brandId || undefined, modelId, price: Number(price), stock: Number(stock), returnRestricted: restricted }),
      });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { message?: string }).message ?? "Не удалось сохранить");
      setDone(`Деталь «${preview}» добавлена${place ? ` в категорию «${categories.find((node) => node.id === place)?.nameRu ?? ""}»` : " без категории"}.`);
      setNameExtra(""); setManualName(""); setPrice(""); setStock("1"); setModelId("");
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить"); }
    finally { setBusy(false); }
  }

  return <details className="admin-card" open={defaultOpen || undefined} style={{ marginBottom: 16 }}>
    <summary>+ Добавить деталь</summary>
    {!types.length && <p className="admin-note">В справочнике ещё нет типов деталей. Название придётся вписать вручную — или заведите типы в разделе «Справочники».</p>}
    <form className="admin-form-grid" onSubmit={submit}>
      <label className="admin-field">Тип детали
        <select onChange={(event) => { setTypeId(event.target.value); setSide(""); setPosition(""); setCategoryId(""); }} value={typeId}>
          <option value="">Вписать название вручную</option>
          {types.map((item) => <option key={item.id} value={item.id}>{item.nameRu}</option>)}
        </select>
      </label>
      {!type && <label className="admin-field">Название<input onChange={(event) => setManualName(event.target.value)} required value={manualName} /></label>}
      {type?.hasSide && <label className="admin-field">Сторона<select onChange={(event) => setSide(event.target.value)} required value={side}><option value="">Выберите</option>{sides.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      {type?.hasPosition && <label className="admin-field">Положение<select onChange={(event) => setPosition(event.target.value)} required value={position}><option value="">Выберите</option>{positions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      {type && <label className="admin-field">Уточнение к названию<input onChange={(event) => setNameExtra(event.target.value)} placeholder="например, в сборе" value={nameExtra} /></label>}
      <label className="admin-field">Бренд детали
        <select onChange={(event) => setBrandId(event.target.value)} value={brandId}>
          <option value="">Не указан</option>
          {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select>
        <span className="admin-note">Производитель детали: Bosch, Zimmermann, Mercedes-Benz. Машина, с которой деталь снята, указывается донором.</span>
      </label>
      <label className="admin-field">Категория каталога
        <select onChange={(event) => setCategoryId(event.target.value)} value={place}>
          <option value="">Без категории</option>
          {categories.map((node) => <option key={node.id} value={node.id}>{"— ".repeat(node.depth - 1)}{node.nameRu}</option>)}
        </select>
      </label>
      <label className="admin-field">Модель автомобиля
        <select onChange={(event) => setModelId(event.target.value)} value={modelId}>
          <option value="">Не указана</option>
          {makes.map((make) => make.models.map((model) => <option key={model.id} value={model.id}>{make.name} {model.name}</option>))}
        </select>
      </label>
      <label className="admin-field">Цена MDL<input min="0" onChange={(event) => setPrice(event.target.value)} required type="number" value={price} /></label>
      <label className="admin-field">Остаток<input min="0" onChange={(event) => setStock(event.target.value)} required type="number" value={stock} /></label>
      <label className="admin-field admin-field-check">
        <input checked={Boolean(noReturn)} disabled={type?.returnRestricted} onChange={(event) => setRestricted(event.target.checked)} type="checkbox" />
        <span>Не подлежит возврату{type?.returnRestricted ? " — так задано у этого типа" : ""}</span>
      </label>
      {preview && <p className="admin-note admin-field-wide">В каталоге деталь будет называться: <strong>{preview}</strong></p>}
      <div className="admin-field-wide admin-image-actions">
        <button className="admin-button" disabled={busy || (!type && manualName.trim().length < 3) || !price} type="submit">{busy ? "Сохраняем…" : "Добавить"}</button>
      </div>
      {error && <p className="admin-error admin-field-wide" role="alert">{error}</p>}
      {done && <p className="admin-success admin-field-wide" role="status">{done}</p>}
    </form>
  </details>;
}
