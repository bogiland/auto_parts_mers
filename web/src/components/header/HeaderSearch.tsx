import { Search } from "lucide-react";

interface HeaderSearchProps {
  mobile?: boolean;
}

export function HeaderSearch({ mobile = false }: HeaderSearchProps) {
  const placeholder = mobile ? "Поиск по коду или названию" : "Поиск по коду детали, модели или категории";

  return (
    <form action="/catalog" className="flex min-w-0 flex-1" role="search">
      <label className="sr-only" htmlFor={mobile ? "mobile-catalog-search" : "catalog-search"}>Поиск по каталогу</label>
      <input
        className="h-control min-w-0 flex-1 rounded-l-ui border-2 border-r-0 border-accent bg-surface pl-3.5 pr-11 text-body text-ink outline-none placeholder:text-muted-2 focus:border-accent"
        id={mobile ? "mobile-catalog-search" : "catalog-search"}
        name="q"
        placeholder={placeholder}
        type="search"
      />
      <button aria-label="Искать" className="h-control w-12 rounded-r-ui bg-accent text-white hover:bg-accent-hover" type="submit">
        <Search aria-hidden="true" className="mx-auto" size={20} strokeWidth={1.8} />
      </button>
    </form>
  );
}
