"use client";
// «+ Деталь» для телефона: один экран — один шаг. Фото → донор → тип → цена и место.
// Название, категория, применимость и состав подставляются сами, но их можно открыть и поправить.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Trash, X } from "lucide-react";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { staffCall } from "@/components/admin/staff-client";
import type { PartType, VehicleMake } from "@/lib/reference-db";
import { nameHint, type AttrTemplate } from "@/lib/attributes";
import { AttributeFields, fieldsFor, type AttrDraft, type CategoryRef } from "./AttributeFields";

type Donor = { id: string; make: string; model: string; generation: string; year: number | null; engine: string; mileage: number | null; parts: number };
type Category = { id: string; nameRu: string; depth: number };
type Photo = { src: string; preview: string; closeup: boolean };
type Duplicate = { id: string; nameRu: string; sku: string } | null;

const conditions = [
  { id: "new", label: "Новая" },
  { id: "good", label: "Б/у, хорошее" },
  { id: "defect", label: "С дефектом" },
  { id: "parts", label: "На запчасти" },
];

const steps = ["Фото", "Донор", "Тип детали", "Цена и бренд", "Проверка"];

function donorLabel(donor: Donor) {
  return [donor.make, donor.model, donor.generation, donor.year ? String(donor.year) : ""].filter(Boolean).join(" ");
}

export function AddPartWizard({ donors, types, categories, makes, locations, typeUsage, onClose, templates = [], brands = [], categoryRefs = [] }: {
  donors: Donor[]; types: PartType[]; categories: Category[]; makes: VehicleMake[]; locations: string[];
  typeUsage: Record<string, number>; onClose: () => void;
  /** П6: шаблон характеристик, бренды деталей и дерево категорий для подбора полей. */
  templates?: AttrTemplate[]; brands?: { id: string; name: string }[]; categoryRefs?: CategoryRef[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [donorList, setDonorList] = useState(donors);
  const [donorId, setDonorId] = useState<string>("");
  const [donorSearch, setDonorSearch] = useState("");
  const [newDonor, setNewDonor] = useState<{ make: string; model: string; year: string; engine: string } | null>(null);
  const [typeId, setTypeId] = useState("");
  const [typeSearch, setTypeSearch] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [side, setSide] = useState("");
  const [position, setPosition] = useState("");
  const [condition, setCondition] = useState("good");
  const [price, setPrice] = useState("");
  const [onRequest, setOnRequest] = useState(false);
  const [location, setLocation] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [nameRo, setNameRo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [includes, setIncludes] = useState("");
  const [applicability, setApplicability] = useState("");
  const [stock, setStock] = useState("1");
  // Обязательный бренд детали и необязательные OEM, характеристики, кроссы, состояние словами.
  const [brandId, setBrandId] = useState("");
  const [oem, setOem] = useState("");
  const [attrs, setAttrs] = useState<AttrDraft>({});
  const [crossText, setCrossText] = useState("");
  const [conditionNote, setConditionNote] = useState("");
  const [duplicate, setDuplicate] = useState<Duplicate>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<{ id: string; sku: string; name: string } | null>(null);

  // Место на складе запоминается: подряд заводят детали в одну ячейку.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setLocation(localStorage.getItem("naa-admin-location") ?? ""); } catch { /* приватный режим браузера: хранилище недоступно */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const type = types.find((item) => item.id === typeId) ?? null;
  const donor = donorList.find((item) => item.id === donorId) ?? null;
  const sortedTypes = useMemo(() => {
    const text = typeSearch.trim().toLowerCase();
    return [...types]
      .filter((item) => !text || `${item.nameRu} ${item.nameRo}`.toLowerCase().includes(text))
      .sort((left, right) => (typeUsage[right.id] ?? 0) - (typeUsage[left.id] ?? 0) || left.nameRu.localeCompare(right.nameRu, "ru"));
  }, [types, typeSearch, typeUsage]);
  const visibleDonors = useMemo(() => {
    const text = donorSearch.trim().toLowerCase();
    return text ? donorList.filter((item) => donorLabel(item).toLowerCase().includes(text)) : donorList.slice(0, 5);
  }, [donorList, donorSearch]);

  const fields = useMemo(() => fieldsFor(templates, categoryRefs, categoryId || type?.categoryId || null, typeId || null), [templates, categoryRefs, categoryId, type, typeId]);
  // Подсказка названия: тип, сторона, отмеченные характеристики («320 мм, вентилируемый») и донор.
  const autoName = useMemo(() => {
    if (!type) return "";
    const sideLabel = type.hasSide ? ({ left: "левая", right: "правая" } as Record<string, string>)[side] ?? "" : "";
    const positionLabel = type.hasPosition ? ({ front: "передняя", rear: "задняя" } as Record<string, string>)[position] ?? "" : "";
    const values = Object.fromEntries(Object.entries(attrs).filter(([, value]) => value !== "").map(([key, value]) => [key, value === "true" ? true : value === "false" ? false : value]));
    return [nameHint([type.nameRu, sideLabel, positionLabel].filter(Boolean).join(" "), fields, values), donor ? donorLabel(donor) : ""].filter(Boolean).join(" ");
  }, [type, side, position, donor, attrs, fields]);

  function stepReady(index: number) {
    if (index === 0) return photos.length > 0;
    if (index === 1) return true;
    if (index === 2) return Boolean(typeId) && (!type?.hasSide || Boolean(side)) && (!type?.hasPosition || Boolean(position));
    if (index === 3) return (onRequest || price.trim() !== "") && Boolean(brandId);
    return true;
  }

  async function goNext() {
    setError("");
    if (step === 2 && donorId && typeId) {
      try {
        const data = await staffCall<{ duplicate: Duplicate }>("parts", { action: "check-duplicate", donorId, partTypeId: typeId, side: type?.hasSide ? side : "" });
        setDuplicate(data.duplicate);
      } catch { setDuplicate(null); }
    }
    if (step === 3) {
      // Название не фиксируется здесь: подсказка обновляется, пока заполняют характеристики.
      setApplicability((current) => current || (donor ? donorLabel(donor) : ""));
      setIncludes((current) => current || (type?.assembly ? type.assemblyIncludes : ""));
      setCategoryId((current) => current || type?.categoryId || "");
    }
    setStep(Math.min(steps.length - 1, step + 1));
  }

  async function addDonor() {
    if (!newDonor?.make.trim()) { setError("Укажите хотя бы марку машины."); return; }
    setBusy(true); setError("");
    try {
      const data = await staffCall<{ id: string }>("parts", { action: "save-donor", make: newDonor.make, model: newDonor.model, year: newDonor.year, engine: newDonor.engine });
      const created: Donor = { id: data.id, make: newDonor.make, model: newDonor.model, generation: "", year: newDonor.year ? Number(newDonor.year) : null, engine: newDonor.engine, mileage: null, parts: 0 };
      setDonorList([created, ...donorList]);
      setDonorId(data.id);
      setNewDonor(null);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить донора"); }
    finally { setBusy(false); }
  }

  async function addType() {
    const name = newTypeName.trim();
    if (name.length < 2) { setError("Напишите название типа детали."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/staff/reference", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-part-type", nameRu: name }) });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { message?: string }).message ?? "Не удалось сохранить тип");
      setNewTypeName("");
      router.refresh();
      setError("");
      setTypeSearch(name);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить тип"); }
    finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setError("");
    try {
      const data = await staffCall<{ id: string; sku: string; name: string }>("parts", {
        action: "add-part", partTypeId: typeId, side, position, donorId, condition,
        price: onRequest ? "" : price, priceOnRequest: onRequest, stock, location,
        nameRu: nameRu || autoName, nameRo, categoryId, includes, applicability,
        brandId, oem, attrs, crossNumbers: crossText, conditionNote,
        photos: photos.map((photo) => ({ src: photo.src, preview: photo.preview, closeup: photo.closeup })),
      });
      try { localStorage.setItem("naa-admin-location", location); } catch { /* приватный режим браузера */ }
      setSaved(data);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить деталь"); }
    finally { setBusy(false); }
  }

  function again() {
    setSaved(null);
    setStep(0);
    setPhotos([]);
    setTypeId(""); setSide(""); setPosition(""); setTypeSearch("");
    setPrice(""); setOnRequest(false); setNameRu(""); setNameRo(""); setIncludes(""); setApplicability("");
    setOem(""); setAttrs({}); setCrossText(""); setConditionNote("");
    setDuplicate(null); setError("");
  }

  if (saved) return <div className="admin-dialog-backdrop">
    <section aria-label="Деталь сохранена" className="admin-detail" role="dialog">
      <header><h2>Деталь сохранена</h2><button aria-label="Закрыть" onClick={onClose} type="button"><X size={22} /></button></header>
      <p className="admin-success">{saved.name}</p>
      <p className="admin-muted">Артикул {saved.sku}. Он больше не изменится, даже если переименовать деталь.</p>
      <div className="admin-image-actions">
        <Link className="admin-ghost-button" href={`/products/${saved.id}`} target="_blank">Открыть на сайте</Link>
        {donor && <button className="admin-button" onClick={again} type="button"><Plus size={16} />Ещё с этого донора</button>}
        <button className="admin-ghost-button" onClick={onClose} type="button">Готово</button>
      </div>
    </section>
  </div>;

  return <div className="admin-dialog-backdrop">
    <section aria-label="Новая деталь" className="admin-detail admin-wizard" role="dialog">
      <header>
        <h2>Деталь · шаг {step + 1} из {steps.length}: {steps[step]}</h2>
        <button aria-label="Закрыть" onClick={() => { if (window.confirm("Закрыть? Введённое не сохранится.")) onClose(); }} type="button"><X size={22} /></button>
      </header>
      <ol className="admin-steps">{steps.map((label, index) => <li aria-current={index === step ? "step" : undefined} className={index <= step ? "is-done" : ""} key={label}>{label}</li>)}</ol>

      {step === 0 && <div className="admin-step">
        <p className="admin-note">Дневной свет, ровный фон, деталь целиком. Номер и бирку снимайте отдельным кадром и ставьте отметку «крупный план» — по ней потом ищут деталь.</p>
        <ImagePicker
          help="До шести фото. Первое станет обложкой."
          label={`Фото детали (${photos.length} из 10)`}
          onChange={(next) => { const src = next.part; if (src && photos.length < 10) setPhotos([...photos, { src, preview: next.preview ?? "", closeup: false }]); }}
          presets={["part"]}
          previewPreset="part-preview"
          value={{}}
        />
        <ImagePicker
          help="Отдельный кадр ближе: номер, бирка или дефект."
          label="Крупный план"
          onChange={(next) => { const src = next["part-closeup"]; if (src && photos.length < 10) setPhotos([...photos, { src, preview: next.preview ?? "", closeup: true }]); }}
          presets={["part-closeup"]}
          previewPreset="part-preview"
          value={{}}
        />
        {photos.length > 0 && <div className="admin-gallery-grid">{photos.map((photo, index) => <figure className="admin-gallery-item" key={photo.src}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={photo.preview || photo.src} />
          {index === 0 && <span className="admin-gallery-cover">Обложка</span>}
          <figcaption>
            <label><input checked={photo.closeup} onChange={(event) => setPhotos(photos.map((item, position_) => (position_ === index ? { ...item, closeup: event.target.checked } : item)))} type="checkbox" />крупный план</label>
            <button aria-label="Удалить фото" className="admin-icon-button" onClick={() => { if (window.confirm("Удалить это фото?")) setPhotos(photos.filter((_, position_) => position_ !== index)); }} type="button"><Trash size={14} /></button>
          </figcaption>
        </figure>)}</div>}
        <p className={photos.length ? "admin-muted" : "admin-warning"}>Нужно хотя бы одно фото детали: без него покупатель видит заглушку и звонит.</p>
      </div>}

      {step === 1 && <div className="admin-step">
        <p className="admin-note">С какой машины снята деталь. Последние пять — сверху.</p>
        <label className="admin-field">Поиск по машинам<input onChange={(event) => setDonorSearch(event.target.value)} placeholder="Mercedes W212" value={donorSearch} /></label>
        <div className="admin-list">
          {visibleDonors.map((item) => <button className={`admin-card admin-row admin-sub-card ${donorId === item.id ? "is-active" : ""}`} key={item.id} onClick={() => setDonorId(item.id)} type="button">
            <div className="admin-tree-name"><strong>{donorLabel(item)}</strong><small className="admin-muted">{[item.engine, item.mileage === null ? "" : `${item.mileage.toLocaleString("ru-RU")} км`, `деталей: ${item.parts}`].filter(Boolean).join(" · ")}</small></div>
            {donorId === item.id && <Check size={18} />}
          </button>)}
          {!visibleDonors.length && <p className="admin-muted">Машин пока нет — создайте нового донора.</p>}
        </div>
        {newDonor
          ? <div className="admin-card admin-sub-card">
              <h3>Новый донор</h3>
              <div className="admin-form-grid">
                <label className="admin-field">Марка<input list="wizard-makes" onChange={(event) => setNewDonor({ ...newDonor, make: event.target.value })} value={newDonor.make} /></label>
                <label className="admin-field">Модель<input onChange={(event) => setNewDonor({ ...newDonor, model: event.target.value })} value={newDonor.model} /></label>
                <label className="admin-field">Год<input max={new Date().getFullYear() + 1} min="1950" onChange={(event) => setNewDonor({ ...newDonor, year: event.target.value })} type="number" value={newDonor.year} /></label>
                <label className="admin-field">Двигатель<input onChange={(event) => setNewDonor({ ...newDonor, engine: event.target.value })} placeholder="OM651 2.1 дизель" value={newDonor.engine} /></label>
              </div>
              <datalist id="wizard-makes">{makes.map((make) => <option key={make.id} value={make.name} />)}</datalist>
              <p className="admin-muted">Фото и пробег можно добавить позже в разделе «Доноры».</p>
              <div className="admin-image-actions">
                <button className="admin-button" disabled={busy} onClick={addDonor} type="button">Сохранить донора</button>
                <button className="admin-ghost-button" onClick={() => setNewDonor(null)} type="button">Отмена</button>
              </div>
            </div>
          : <button className="admin-ghost-button" onClick={() => setNewDonor({ make: "", model: "", year: "", engine: "" })} type="button"><Plus size={16} />Новый донор</button>}
        <p className="admin-muted">Донора можно не указывать — например, для нового расходника.</p>
      </div>}

      {step === 2 && <div className="admin-step">
        <label className="admin-field">Поиск по справочнику<input onChange={(event) => setTypeSearch(event.target.value)} placeholder="Фара, дверь, стартер" value={typeSearch} /></label>
        <div className="admin-chips">
          {sortedTypes.slice(0, 24).map((item) => <button className={typeId === item.id ? "is-active" : ""} key={item.id} onClick={() => { setTypeId(item.id); setSide(""); setPosition(""); }} type="button">{item.nameRu}{typeUsage[item.id] ? <small> {typeUsage[item.id]}</small> : null}</button>)}
        </div>
        {!sortedTypes.length && <div className="admin-quick-add">
          <label className="admin-field">Такого типа нет — добавить в справочник<input onChange={(event) => setNewTypeName(event.target.value)} placeholder={typeSearch} value={newTypeName || typeSearch} /></label>
          <button className="admin-button" disabled={busy} onClick={addType} type="button">Добавить тип</button>
        </div>}
        {type?.hasSide && <div className="admin-step-row">
          <span>Сторона</span>
          <div className="admin-tabs">
            <button className={side === "left" ? "is-active" : ""} onClick={() => setSide("left")} type="button">Левая</button>
            <button className={side === "right" ? "is-active" : ""} onClick={() => setSide("right")} type="button">Правая</button>
          </div>
        </div>}
        {type?.hasPosition && <div className="admin-step-row">
          <span>Положение</span>
          <div className="admin-tabs">
            <button className={position === "front" ? "is-active" : ""} onClick={() => setPosition("front")} type="button">Перед</button>
            <button className={position === "rear" ? "is-active" : ""} onClick={() => setPosition("rear")} type="button">Зад</button>
          </div>
        </div>}
        {type?.returnRestricted && <p className="admin-warning">Этот тип возврату не подлежит — отметка поставится сама и её нельзя снять.</p>}
        {autoName && <p className="admin-note">В каталоге деталь будет называться: <strong>{autoName}</strong></p>}
      </div>}

      {step === 3 && <div className="admin-step">
        <div className="admin-step-row">
          <span>Состояние</span>
          <div className="admin-tabs">{conditions.map((item) => <button className={condition === item.id ? "is-active" : ""} key={item.id} onClick={() => setCondition(item.id)} type="button">{item.label}</button>)}</div>
        </div>
        <div className="admin-form-grid">
          <label className="admin-field">Бренд детали
            <select onChange={(event) => setBrandId(event.target.value)} required value={brandId}>
              <option value="">Выберите</option>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
            <span className="admin-note">Производитель детали: Bosch, Zimmermann, Mercedes-Benz. Не машина-донор.</span>
          </label>
          <label className="admin-field">Номер OEM, если есть
            <input autoCapitalize="characters" onChange={(event) => setOem(event.target.value)} placeholder="A212 820 03 39" value={oem} />
            <span className="admin-note">Сфотографируйте табличку с номером. Это номер на самой детали — по нему ищут в Google.</span>
          </label>
          <label className="admin-field">Цена, L.<input disabled={onRequest} min="0" onChange={(event) => setPrice(event.target.value)} type="number" value={price} /></label>
          <label className="admin-field admin-field-check"><input checked={onRequest} onChange={(event) => setOnRequest(event.target.checked)} type="checkbox" />Цена по запросу</label>
          <label className="admin-field">Остаток<input min="0" onChange={(event) => setStock(event.target.value)} type="number" value={stock} /></label>
          <label className="admin-field">Место на складе<input list="wizard-locations" onChange={(event) => setLocation(event.target.value)} placeholder="Стеллаж Б, полка 3" value={location} /></label>
        </div>
        <datalist id="wizard-locations">{locations.map((item) => <option key={item} value={item} />)}</datalist>
        <p className="admin-muted">Место запоминается и подставится в следующую деталь.</p>
      </div>}

      {step === 4 && <div className="admin-step">
        {duplicate && <div className="admin-warning" role="alert">
          <p>С этой машины уже заведена такая деталь: <strong>{duplicate.nameRu}</strong> ({duplicate.sku}). Если это вторая такая же — сохраняйте, иначе отмените.</p>
        </div>}
        <p className="admin-note">Всё ниже подставлено автоматически. Можно поправить любое поле.</p>
        <div className="admin-form-grid">
          <label className="admin-field admin-field-wide">Название, русский<input onChange={(event) => setNameRu(event.target.value)} value={nameRu || autoName} /></label>
          <label className="admin-field admin-field-wide">Название, румынский<input onChange={(event) => setNameRo(event.target.value)} placeholder="Подставится, если у типа заполнено румынское название" value={nameRo} /></label>
          <label className="admin-field">Категория каталога<select onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
            <option value="">Без категории</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{"— ".repeat(Math.max(0, item.depth - 1))}{item.nameRu}</option>)}
          </select></label>
          <label className="admin-field admin-field-wide">Применимость<input onChange={(event) => setApplicability(event.target.value)} value={applicability} /></label>
          {type?.assembly && <label className="admin-field admin-field-wide">Что входит в сборку<textarea onChange={(event) => setIncludes(event.target.value)} rows={2} value={includes} /></label>}
          <label className="admin-field admin-field-wide">Состояние словами<input onChange={(event) => setConditionNote(event.target.value)} placeholder="скол на нижнем ухе, стекло целое" value={conditionNote} /></label>
        </div>
        <details className="admin-card admin-sub-card">
          <summary>Характеристики и кроссы — необязательно, можно дозаполнить потом</summary>
          <AttributeFields onChange={setAttrs} templates={fields} value={attrs} />
          <label className="admin-field admin-field-wide">Кросс-номера<input onChange={(event) => setCrossText(event.target.value)} placeholder="Brembo: P 50 011; Bosch: 0986494071" value={crossText} /></label>
        </details>
        <ul className="admin-summary">
          <li>Фото: {photos.length}{photos.some((photo) => photo.closeup) ? ", есть крупный план" : ""}</li>
          <li>Донор: {donor ? donorLabel(donor) : "не указан"}</li>
          <li>Состояние: {conditions.find((item) => item.id === condition)?.label}</li>
          <li>Цена: {onRequest ? "по запросу" : `${Number(price || 0).toLocaleString("ru-RU")} L.`}</li>
          <li>Бренд: {brands.find((brand) => brand.id === brandId)?.name ?? "не выбран"}{oem ? ` · OEM ${oem}` : ""}</li>
          <li>Остаток: {stock}{location ? ` · место ${location}` : ""}</li>
          <li>Артикул выдаст система при сохранении и больше не изменит</li>
        </ul>
      </div>}

      {error && <p className="admin-error" role="alert">{error}</p>}
      <footer className="admin-wizard-footer">
        <button className="admin-ghost-button" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))} type="button"><ArrowLeft size={16} />Назад</button>
        {step < steps.length - 1
          ? <button className="admin-button" disabled={!stepReady(step) || busy} onClick={goNext} type="button">Дальше<ArrowRight size={16} /></button>
          : <button className="admin-button" disabled={busy} onClick={save} type="button">{busy ? "Сохраняем…" : "Сохранить деталь"}</button>}
      </footer>
    </section>
  </div>;
}
