# NAA.MD — Design Tokens

Все токены выведены из референс-скрина главной. База — минималистичная тема (белое / серое / чёрное) с красным Mercedes-акцентом.

---

## 1. Цветовая палитра

| Роль | HEX | RGB | Где используется |
|---|---|---|---|
| **Body background** | `#F7F7F7` | rgb(247, 247, 247) | Общий фон страницы |
| **Surface / card** | `#FFFFFF` | rgb(255, 255, 255) | Карточки, sidebar, поиск, hero |
| **Text primary** | `#1A1A1A` | rgb(26, 26, 26) | H1, названия, логотип |
| **Text body** | `#3A3A3A` | rgb(58, 58, 58) | Обычные абзацы, ссылки в меню |
| **Text muted** | `#8A8A8A` | rgb(138, 138, 138) | Подписи, метки, счётчики |
| **Border / divider** | `#EAEAEA` | rgb(234, 234, 234) | Границы карточек, разделители, инпуты |
| **Border hover** | `#D0D0D0` | rgb(208, 208, 208) | Границы при наведении |
| **Accent RED (Mercedes)** | `#E30613` | rgb(227, 6, 19) | Основные CTA — кнопка «Caută», акции, ошибки |
| **Accent RED hover** | `#B8050F` | rgb(184, 5, 15) | Тёмный красный при hover CTA |
| **Dark CTA (VIN block)** | `#1A1A1A` | rgb(26, 26, 26) | Тёмная плашка VIN-поиска, чёрные кнопки |
| **Dark CTA hover** | `#000000` | rgb(0, 0, 0) | Hover для тёмных кнопок |
| **Success green** | `#22C55E` | rgb(34, 197, 94) | Badge на иконке корзины, «в наличии» |
| **Chat FAB bg** | `#EEEEEE` | rgb(238, 238, 238) | Круглая кнопка чата справа снизу |
| **Footer bg** *(опция)* | `#0F0F0F` | rgb(15, 15, 15) | Если футер тёмный (см. layout) |

**Ключевое отличие от sad.md**: убран зелёный как основной акцент. Зелёный остаётся ТОЛЬКО как микро-badge. Основа — чёрное + красное.

---

## 2. Шрифт

**Единственное семейство**: `Inter` (Google Fonts). Опционально альтернатива — `Manrope`.

Веса: 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 800 (extra-bold).

Подключить:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

CSS:
```css
:root { font-family: 'Inter', system-ui, -apple-system, sans-serif; letter-spacing: -0.01em; }
```

Ключевая деталь Inter — `letter-spacing: -0.01em` на body и `-0.02em` на заголовках. Даёт «сжатый» premium-вид.

---

## 3. Типографика

| Роль | Font-size | Line-height | Weight | Color | Letter-spacing | Где |
|---|---|---|---|---|---|---|
| Body | 15 px | 24 px | 400 | `#3A3A3A` | -0.01em | Обычный текст |
| Nav ссылки | 14 px | 20 px | 500 | `#1A1A1A` | -0.01em | Ссылки в меню/шапке |
| Иконки-подписи (Contul meu, Coş) | 12 px | 16 px | 500 | `#1A1A1A` | 0 | Под иконками в шапке |
| Плейсхолдер поиска | 14 px | 20 px | 400 | `#8A8A8A` | -0.01em | «Caută după cod piesă…» |
| Категория в sidebar | 14 px | 20 px | 500 | `#1A1A1A` | -0.01em | «Motor și componente» и т.п. |
| H1 hero (баннер) | 40 px | 48 px | 700 | `#1A1A1A` | -0.02em | «PIESE PENTRU MERCEDES-BENZ» |
| H2 секции | 22 px | 30 px | 700 | `#1A1A1A` | -0.02em | «Categorii populare» |
| Название категории (плитка) | 15 px | 20 px | 600 | `#1A1A1A` | -0.01em | «Motoare şi componente» |
| Мета-текст под названием | 12 px | 16 px | 400 | `#8A8A8A` | 0 | «1248 produse» |
| Название товара в карточке | 14 px | 20 px | 500 | `#1A1A1A` | -0.01em | Карточка листинга |
| H1 карточки товара | 28 px | 36 px | 700 | `#1A1A1A` | -0.02em | Название товара на его странице |
| Цена | 22 px | 30 px | 700 | `#1A1A1A` | -0.02em | «1 375 L.» |
| Цена крупная (страница товара) | 36 px | 44 px | 800 | `#1A1A1A` | -0.02em | На карточке товара |
| Старая цена (перечёркнутая) | 14 px | 20 px | 400 | `#8A8A8A` | 0 | Со скидкой |
| Кнопка primary (красная) | 14 px | 20 px | 600 | `#FFFFFF` | 0 | «Caută» |
| Кнопка dark (чёрная) | 14 px | 20 px | 600 | `#FFFFFF` | 0 | «Vezi toate piesele» |
| Заголовок в тёмной плашке VIN | 18 px | 24 px | 700 | `#FFFFFF` | -0.02em | «Găseşte piesa după VIN» |
| Подпись в тёмной плашке | 13 px | 20 px | 400 | rgba(255,255,255,.7) | 0 | «Introdu codul VIN…» |
| Крошки | 12 px | 16 px | 500 | `#8A8A8A` | 0 | Хлебные крошки |
| Значок «в наличии» | 11 px | 14 px | 600 | `#FFFFFF` | 0.02em | Зелёный лейбл |
| Заголовки футера | 13 px | 18 px | 700 | `#FFFFFF` | 0.06em UPPERCASE | «INFORMAȚII», «CONTACT» |

---

## 4. Радиусы

| Токен | Значение | Где |
|---|---|---|
| `--radius-sm` | 6 px | Малые бейджи, чекбоксы |
| `--radius-md` | 8 px | Кнопки, инпуты, чипы |
| `--radius-lg` | 12 px | Карточки товара, плитки, hero-баннер |
| `--radius-xl` | 16 px | Тёмная VIN-плашка, крупные блоки |
| `--radius-full` | 9999 px | FAB, аватары, соц-иконки |

Радиусы **крупнее** чем у sad.md — это ключевой визуальный отличитель.

---

## 5. Тени

Тени — очень мягкие, минимальные. Никакой хардкор-глубины.

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.08);
--shadow-red: 0 8px 20px rgba(227, 6, 19, 0.25);  /* для hover красной CTA */
```

Карточки в покое — БЕЗ теней, только border 1px `#EAEAEA` или полностью без границы на белом фоне.
При hover — `--shadow-md` + подъём `translateY(-2px)`.

---

## 6. Иконки

- **Стиль**: outline / stroke 1.5px (не filled!)
- **Библиотека**: **Lucide** (`lucide-react` / cdn https://unpkg.com/lucide@latest)
- **Размеры**: 20×20 в меню/шапке, 24×24 в hero-плитках, 16×16 в мелких элементах
- **Цвет**: `currentColor` — наследуется от родителя, обычно `#1A1A1A` или `#8A8A8A`
- **Чат FAB** (правый нижний): 24×24 внутри круга 56×56, цвет `#8A8A8A` на `#EEEEEE` фоне

Категорийные иконки в sidebar — outline, серые (`#3A3A3A`), с бордюр-рамкой квадрата 32×32 округленной на 6px (см. скрин: у Mercedes-Benz — трёхлучевая звезда).

---

## 7. Специальные компоненты (авто-ниша)

### VIN-плашка (unique block)
```
background: #1A1A1A
padding: 32px
border-radius: 16px
color: #FFFFFF
```
Внутри: заголовок 18px 700, подзаголовок 13px 400 rgba(255,255,255,.7), инпут белый (bg #FFFFFF, radius 8px, height 44px) + красная кнопка «Caută».

### Expert-help блок (правая колонка на главной)
```
background: #FFFFFF
padding: 24px
border-radius: 12px
border: 1px solid #EAEAEA
```
Внутри: круглый аватар эксперта 40×40, имя + сообщение чат-стиля, кнопка «Obţine consultanţă» (dark) и инпут «Scrie un mesaj…».

### Кнопка primary (red)
```
background: #E30613
color: #FFFFFF
padding: 12px 20px
border-radius: 8px
font-size: 14px
font-weight: 600
transition: background .15s;
```
Hover: `background: #B8050F`.

### Кнопка dark (для «Vezi toate», «Obţine consultanţă»)
```
background: #1A1A1A
color: #FFFFFF
padding: 12px 20px
border-radius: 8px
font-size: 14px
font-weight: 600
```
Hover: `background: #000`.

---

## 8. Итог: чем NAA отличается от SAD.MD

| | SAD.MD | NAA.MD |
|---|---|---|
| Шрифт | Montserrat | **Inter** (плотнее, современнее) |
| Акцент | Зелёный `#008000` | **Красный `#E30613`** |
| Верхняя плашка | Красная промо-плашка `#C1433A` | Убрана, чистая шапка |
| Категорийные иконки | Цветные (жёлто-оранжевые) | **Outline серые** |
| Радиусы | 4–8 px | **8–16 px** (крупнее) |
| Уникальный блок | — | **VIN-поиск (тёмная плашка)** + expert-chat |
| Настроение | Стройсклад, дружеский | **Premium, немецкая точность** |
