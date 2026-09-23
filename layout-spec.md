# NAA.MD — Layout Spec

Все замеры сняты с референс-скрина главной NAA.md. Логика та же, что у sad.md, но с более крупной сеткой, минималистичной шапкой и авто-специфичными блоками.

---

## 1. Глобальная сетка

**Container**:
- `max-width: 1600px`
- `padding: 0 24px` *(шире чем у sad.md — воздуха больше)*
- `margin: 0 auto`

**Body**:
- `background: #F7F7F7`
- `font-family: 'Inter', sans-serif`
- `font-size: 15px`
- `line-height: 24px`
- `color: #3A3A3A`
- `letter-spacing: -0.01em`

---

## 2. Шапка (header) — один ряд

**Без красной верхней плашки** (в отличие от sad.md).

```
┌────────────────────────────────────────────────────────────────────────┐
│  [Logo NAA.md]  [────── Search ──────]   [👤 Contul meu] [♡ Favorite]  │
│                                          [🛒 Coş (0)]  [📞 +373 68… │  │
│                                                        Luni-Sâmbătă] │
└────────────────────────────────────────────────────────────────────────┘
```

Замеры:
- `background: #FFFFFF`
- `padding: 20px 0`
- `border-bottom: 1px solid #EAEAEA`
- Общая высота ≈ 96 px

Grid шапки:
```css
display: grid;
grid-template-columns: 180px 1fr auto auto;
gap: 32px;
align-items: center;
```

**Logo** «NAA.md»:
- Текстовый, `font-size: 32px; font-weight: 800; color: #1A1A1A; letter-spacing: -0.03em;`
- «.md» тем же цветом (не выделяется, как у sad.md зелёным)

**Поиск**:
- `height: 48px`
- `background: #F7F7F7` (чуть темнее чем шапка) *или* `border: 1px solid #EAEAEA` на белом
- `border-radius: 8px`
- `padding: 0 20px`
- `font-size: 14px`
- Иконка-лупа справа `#8A8A8A` 20×20

**Иконки-действия** (Contul meu / Favorite / Coş):
- Каждая — иконка 24×24 сверху + подпись 12px 500 снизу
- `gap: 6px` между иконкой и подписью
- `gap: 24px` между колонками
- Badge на корзине: маленький круг 16×16, `background: #22C55E`, белая цифра 10px

**Телефон-блок справа**:
- Иконка телефона 20×20 + два ряда текста:
  - Ряд 1: телефон, 14px 600 `#1A1A1A`
  - Ряд 2: «Luni - Sâmbătă  09:00 - 18:00», 12px 400 `#8A8A8A`

---

## 3. Основной слой — двухколоночный

На главной / категориях:
```
container
├── sidebar          width: 280 px
├── gap              24 px
└── main             flex: 1
```

**Sidebar**:
- `background: #FFFFFF`
- `border-radius: 12px`
- `padding: 8px 0`
- Header sidebar: «Toate categoriile» с иконкой ▤, `padding: 16px 20px; font-size: 14px; font-weight: 700;`

**Пункт категории**:
- `padding: 12px 20px`
- `display: flex; align-items: center; gap: 12px;`
- Иконка 20×20 outline
- Текст 14px 500 `#1A1A1A`
- Chevron `›` справа `#8A8A8A`, `margin-left: auto`
- Hover: `background: #F7F7F7`
- Активный: `background: #F7F7F7`, левая рамка 3px `#E30613`

Для авто-ниши в списке — специфичные категории:
- Motor și componente
- Sistem de frânare
- Suspensie și direcție
- Transmisie și cutie de viteză
- Sistem electric
- Răcire și încălzire
- Caroserie și exterior
- Interior și confort
- Sistem de evacuare
- Filtre și consumabile
- Rulmenți și elemente de fixare
- Accesorii și tuning
- **Piese originale Mercedes-Benz** (с иконкой Mercedes-звезды, выделено внизу отдельным блоком)

---

## 4. Hero-баннер

- `background: linear-gradient(135deg, #FFFFFF 0%, #F0F0F0 100%)` — светлый градиент
- `border-radius: 12px`
- `padding: 48px 56px`
- `min-height: 320px`
- Grid: `[text 45%] [image 55%]`

Внутри:
- Слева:
  - Мелкая метка/eyebrow сверху (опционально) 12px 600 `#E30613` UPPERCASE
  - H1 «PIESE PENTRU MERCEDES-BENZ» — 40px 700 `#1A1A1A`, letter-spacing -0.02em
  - Подзаголовок 18px 400 `#8A8A8A` «Calitate. Fiabilitate. Performanţă.»
  - Кнопка dark «Vezi toate piesele →», 12px 20px padding, radius 8, стрелка 16px справа
- Справа: композиция «Mercedes + запчасти» + справа-сверху лого Mercedes-Benz (48×48) + подпись «The best or nothing»

---

## 5. Секция «Categorii populare» (6 плиток в ряд)

Заголовок секции — 22px 700 `#1A1A1A` слева, справа ссылка «Vezi toate categoriile →» 14px 500 `#8A8A8A`.

Grid плиток:
```css
display: grid;
grid-template-columns: repeat(6, 1fr);
gap: 16px;
```

**Плитка категории**:
- `background: #FFFFFF`
- `border-radius: 12px`
- `padding: 20px`
- `border: 1px solid transparent`
- Hover: `border-color: #EAEAEA; transform: translateY(-2px);`
- Внутри:
  - Изображение запчасти по центру, высота 140px, `object-fit: contain`
  - Ниже: строка с названием 15px 600 + chevron `›` справа
  - Ещё ниже: мета «1248 produse» 12px 400 `#8A8A8A`

---

## 6. VIN-блок (уникальный, специфичный для авто)

```
background: #1A1A1A
border-radius: 16px
padding: 32px
color: #FFFFFF
```

Grid внутри:
```
[текст-описание слева]  [инпут VIN + кнопка Caută]
```

Или в две колонки для главной:
```
container
├── VIN-блок  (2/3 ширины)
└── Expert-помощь  (1/3 ширины)
```

Элементы:
- Заголовок «Găseşte piesa după VIN» — 18px 700 white
- Подпись «Introdu codul VIN al maşinii tale şi găseşte piesa potrivită.» — 13px 400 rgba(255,255,255,.7)
- Инпут (белый на тёмном): `height: 44px; background: #FFFFFF; color: #1A1A1A; border-radius: 8px; padding: 0 16px;`
- Справа от инпута — маленькая иконка сканера/камеры 20×20
- Кнопка «Caută» — красная, 44px высоты, `padding: 0 32px; border-radius: 8px;`

---

## 7. Expert-помощь блок

```
background: #FFFFFF
border-radius: 12px
padding: 24px
border: 1px solid #EAEAEA
```

Структура:
- Заголовок «Ai nevoie de ajutor?» — 16px 700
- Подпись «Consultă un expert pentru alegerea pieselor potrivite pentru maşina ta.» — 13px 400 `#8A8A8A`
- Ряд с аватаром + именем: круглый аватар 40×40 + справа «Expert NAA.md» 14px 600 / «Bună! Cu ce te putem ajuta astăzi?» 12px 400 `#8A8A8A`
- Кнопка dark «Obţine consultanţă»
- Инпут «Scrie un mesaj…» + иконка отправки ↑

---

## 8. Карточка товара (листинг)

```
┌──────────────────────────┐
│                          │
│    [product image]       │  height 220px
│                          │
├──────────────────────────┤
│ [в наличии] badge        │  зелёный, top-left
│ Название запчасти        │  14px 500 #1A1A1A, 3 строки макс
│ Артикул: A0001234567     │  12px 400 #8A8A8A
│                          │
│ 890 L.                   │  22px 700 #1A1A1A
├──────────────────────────┤
│ [🛒 Adaugă în coş]       │  Красная широкая кнопка
└──────────────────────────┘
```

- `background: #FFFFFF`
- `border-radius: 12px`
- `padding: 20px`
- Hover: `box-shadow: 0 12px 32px rgba(0,0,0,.08); transform: translateY(-2px);`
- Кнопка «Adaugă în coş» — full-width red, `height: 44px; border-radius: 8px;`

---

## 9. Страница товара

```
container
├── breadcrumbs
├── H1 (28px)
├── grid [gallery 1fr | info 1fr]  gap 40px
│   ├── gallery: main 500x500 + thumbs 4×80x80
│   └── info: артикул/бренд, цена крупная 36px 800, «Adaugă în coş» red 100% width, «Găseşte piesa după VIN» dark button, характеристики table
└── ниже: описание + характеристики полные
```

Табы под H1 отсутствуют (в отличие от sad.md) — вместо них секции идут одна под другой в главной панели.

---

## 10. Статичные страницы

Container без sidebar, белая карточка `padding: 48px; border-radius: 12px;` шириной до 900px по центру.

H1 — 32px 700 `#1A1A1A`, `margin-bottom: 32px`.

---

## 11. Footer

Тёмный, минимальный.

- `background: #0F0F0F`
- `color: rgba(255,255,255,.7)`
- `padding: 48px 0 24px`

Grid: 4 колонки `[logo+about] [Company links] [Support links] [Contact]`.

Заголовки колонок: 13px 700 UPPERCASE `#FFFFFF` letter-spacing 0.06em.
Ссылки: 14px 400 rgba(255,255,255,.7), hover — `#FFFFFF`, без подчёркивания.

Copyright снизу — 12px 400 rgba(255,255,255,.5), центрирован, отделён тонкой линией `border-top: 1px solid rgba(255,255,255,.08); padding-top: 20px;`.

---

## 12. Плавающие FAB (right-bottom)

- Одна круглая кнопка чата 56×56, `background: #EEEEEE`, иконка ✉ 24×24 `#8A8A8A`
- `position: fixed; right: 32px; bottom: 32px;`
- `box-shadow: 0 8px 20px rgba(0,0,0,.08);`

(У NAA нет sad.md-шного двойного «Comandă apel» — минимализм.)

---

## 13. Отступы между секциями главной

```
[header]
  ↓ 32 px
[sidebar 280 + main]
    main:
    [Hero baner]
      ↓ 32 px
    [Categorii populare]
      ↓ 32 px
    [VIN-блок 2/3 + Expert-help 1/3]
      ↓ 48 px
[footer]
```
