import { ChevronDown } from "lucide-react";

import { SectionHeader } from "../ui/section-header";

const vehicleFields = [
  { label: "Марка", name: "brand" },
  { label: "Модель", name: "model" },
  { label: "Год", name: "year" },
  { label: "Двигатель", name: "engine" },
  { label: "Модификация", name: "trim" },
] as const;

export function VehicleSearch() {
  return (
    <section className="vehicle-search">
      <SectionHeader title="Начните поиск запчастей по марке вашего автомобиля" />
      <form action="/catalog/legkovye" className="vehicle-search__form">
        <p className="vehicle-search__tab">Поиск по марке авто</p>
        <div className="vehicle-search__fields">
          {vehicleFields.map((field) => (
            <label className="vehicle-search__field" key={field.name}>
              <span className="sr-only">{field.label}</span>
              <select aria-label={field.label} defaultValue="" name={field.name}>
                <option value="">{field.label}</option>
              </select>
              <ChevronDown aria-hidden="true" size={17} />
            </label>
          ))}
          <button type="submit">Найти</button>
        </div>
      </form>
    </section>
  );
}
