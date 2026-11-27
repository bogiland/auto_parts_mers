-- Схема NAA.md для PostgreSQL. Накатывается целиком и повторно: каждый объект создаётся,
-- только если его ещё нет. Боевой провайдер — Supabase, поэтому тут обычный Postgres без
-- расширений, доступных не везде.
--
-- Соглашения, оставленные от первой версии на SQLite, чтобы перенос был честным и проверяемым:
--   * отметки времени хранятся строкой ISO-8601 (их сравнивает и показывает уже приложение);
--   * галочки хранятся числом 0/1 — ровно так их читает код;
--   * денежные суммы — целые единицы валюты, без дробей.

/* ---------- Настройки и каталог ---------- */

CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY CHECK (id = 1),
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_products (
  id text PRIMARY KEY,
  name text NOT NULL,
  name_ro text,
  slug text,
  sku text,
  oem_number text,
  price_mdl integer,
  price_rub integer,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  price_mode text NOT NULL,
  return_restricted integer NOT NULL DEFAULT 0,
  cost_mdl integer,
  product_type text,
  category_id text,
  part_type_id text,
  model_id text,
  donor_id text,
  condition text,
  location text,
  side text,
  position text,
  includes text,
  applicability text,
  photos_json text NOT NULL DEFAULT '[]',
  hidden integer NOT NULL DEFAULT 0,
  created_at text,
  sold_at text
);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_products_slug ON catalog_products (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS catalog_products_category ON catalog_products (category_id);
ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS oem_number text;
CREATE INDEX IF NOT EXISTS catalog_products_donor ON catalog_products (donor_id);
CREATE INDEX IF NOT EXISTS catalog_products_oem ON catalog_products (oem_number);

/* ---------- Покупатели ---------- */

CREATE TABLE IF NOT EXISTS customers (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  surname text NOT NULL DEFAULT '',
  email text NOT NULL UNIQUE,
  phone text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at text NOT NULL,
  active integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash text PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  last_seen bigint NOT NULL,
  revoked integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS customer_sessions_owner ON customer_sessions (customer_id);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  is_default integer NOT NULL DEFAULT 0,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS customer_addresses_owner ON customer_addresses (customer_id);

CREATE TABLE IF NOT EXISTS customer_attempts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  login text NOT NULL,
  at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS customer_attempts_at ON customer_attempts (at);

/* ---------- Сотрудники ---------- */

CREATE TABLE IF NOT EXISTS staff_users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  password_hash text NOT NULL DEFAULT '',
  role text NOT NULL CHECK (role IN ('owner', 'operator')),
  active integer NOT NULL DEFAULT 1,
  -- Доступ, выданный покупателю: пароль берётся из его кабинета, своего у строки нет.
  customer_id integer REFERENCES customers (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES staff_users (id) ON DELETE CASCADE,
  last_seen bigint NOT NULL,
  revoked integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS staff_sessions_owner ON staff_sessions (user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone text NOT NULL,
  at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS login_attempts_at ON login_attempts (at);

CREATE TABLE IF NOT EXISTS staff_audit (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id integer,
  actor_name text NOT NULL,
  action text NOT NULL,
  details text NOT NULL,
  at text NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_audit_at ON staff_audit (at DESC);

/* ---------- Заявки на подбор ---------- */

CREATE TABLE IF NOT EXISTS inquiries (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone text NOT NULL,
  part text NOT NULL,
  vehicle text NOT NULL,
  source text NOT NULL CHECK (source IN ('expert', 'catalog')),
  status text NOT NULL DEFAULT 'new',
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS inquiries_created ON inquiries (created_at DESC);

/* ---------- Заказы ---------- */

CREATE TABLE IF NOT EXISTS orders (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  token text NOT NULL UNIQUE,
  name text NOT NULL,
  phone text NOT NULL,
  contact_method text NOT NULL,
  delivery_method text NOT NULL,
  delivery_title text NOT NULL,
  address text NOT NULL,
  payment_method text NOT NULL,
  payment_title text NOT NULL,
  comment text NOT NULL,
  total_mdl integer NOT NULL,
  total_rub integer,
  status text NOT NULL DEFAULT 'received',
  created_at text NOT NULL,
  source text NOT NULL DEFAULT 'site',
  delivery_cost_mdl integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  against_advice integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  stock_written integer NOT NULL DEFAULT 0,
  cancel_reason text NOT NULL DEFAULT '',
  confirmed_at text,
  issued_at text,
  receipt_token text,
  receipt_at text,
  receipt_json text,
  issue_photos_json text NOT NULL DEFAULT '[]',
  customer_id integer REFERENCES customers (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS orders_phone ON orders (phone);
CREATE INDEX IF NOT EXISTS orders_customer ON orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_receipt ON orders (receipt_token);

/* П1 · безопасность заказов.
   owner_scope — кто оформил заказ: «c:<id кабинета>» или «g:<гостевая сессия>».
   Ключ идемпотентности действует только внутри своей области, поэтому чужой
   повтор не получает ни заказ, ни его токен. У старых записей NULL: они
   читаются как раньше, но повтор по их ключу уже не выдаётся.
   receipt_expires_at / receipt_revoked — срок и отзыв ссылки на чек. */
ALTER TABLE orders ADD COLUMN IF NOT EXISTS owner_scope text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_expires_at text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_revoked integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS orders_owner_scope ON orders (owner_scope);

CREATE TABLE IF NOT EXISTS order_items (
  order_id integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id text NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL,
  unit_price_mdl integer NOT NULL,
  unit_price_rub integer,
  unit_cost_mdl integer,
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_name text NOT NULL,
  comment text NOT NULL DEFAULT '',
  at text NOT NULL
);
CREATE INDEX IF NOT EXISTS order_status_history_order ON order_status_history (order_id, id);

CREATE TABLE IF NOT EXISTS order_returns (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id text NOT NULL,
  product_name text NOT NULL DEFAULT '',
  inspection text NOT NULL DEFAULT '',
  photos_json text NOT NULL DEFAULT '[]',
  decision text NOT NULL,
  amount_mdl integer NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  actor_name text NOT NULL,
  at text NOT NULL
);
CREATE INDEX IF NOT EXISTS order_returns_order ON order_returns (order_id);

/* ---------- Движение остатка ---------- */

CREATE TABLE IF NOT EXISTS stock_moves (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id text NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  order_id integer,
  actor_name text NOT NULL,
  note text NOT NULL DEFAULT '',
  at text NOT NULL,
  undo_until text,
  undone integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS stock_moves_product ON stock_moves (product_id, id DESC);

/* ---------- Справочники ---------- */

CREATE TABLE IF NOT EXISTS ref_categories (
  id text PRIMARY KEY,
  parent_id text REFERENCES ref_categories (id),
  slug text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_ro text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  intro text NOT NULL DEFAULT '',
  seo_title text NOT NULL DEFAULT '',
  seo_description text NOT NULL DEFAULT '',
  visible integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS ref_categories_parent ON ref_categories (parent_id, sort_order);

CREATE TABLE IF NOT EXISTS ref_category_redirects (
  old_slug text PRIMARY KEY,
  category_id text NOT NULL REFERENCES ref_categories (id) ON DELETE CASCADE,
  at text NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_part_types (
  id text PRIMARY KEY,
  name_ru text NOT NULL,
  name_ro text NOT NULL DEFAULT '',
  category_id text REFERENCES ref_categories (id),
  has_side integer NOT NULL DEFAULT 0,
  has_position integer NOT NULL DEFAULT 0,
  assembly integer NOT NULL DEFAULT 0,
  assembly_includes text NOT NULL DEFAULT '',
  return_restricted integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_makes (
  id text PRIMARY KEY,
  name text NOT NULL,
  logo text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_models (
  id text PRIMARY KEY,
  make_id text NOT NULL REFERENCES ref_makes (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS ref_models_make ON ref_models (make_id, sort_order);

CREATE TABLE IF NOT EXISTS ref_generations (
  id text PRIMARY KEY,
  model_id text NOT NULL REFERENCES ref_models (id) ON DELETE CASCADE,
  name text NOT NULL,
  year_from integer,
  year_to integer,
  engines text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS ref_generations_model ON ref_generations (model_id, sort_order);

CREATE TABLE IF NOT EXISTS ref_brands (
  id text PRIMARY KEY,
  name text NOT NULL,
  logo text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at text NOT NULL
);

/* ---------- Доноры и предложения ---------- */

CREATE TABLE IF NOT EXISTS donors (
  id text PRIMARY KEY,
  make_id text,
  model_id text,
  generation_id text,
  make text NOT NULL,
  model text NOT NULL DEFAULT '',
  generation text NOT NULL DEFAULT '',
  year integer,
  engine text NOT NULL DEFAULT '',
  mileage integer,
  note text NOT NULL DEFAULT '',
  photos_json text NOT NULL DEFAULT '[]',
  visible integer NOT NULL DEFAULT 1,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS donors_created ON donors (created_at DESC);

-- Сегодня предложение у детали одно — свой склад. Таблица позволит добавить поставщиков
-- со своей ценой, остатком и сроком, не трогая саму деталь.
CREATE TABLE IF NOT EXISTS part_offers (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES catalog_products (id) ON DELETE CASCADE,
  supplier text NOT NULL DEFAULT 'own',
  supplier_name text NOT NULL DEFAULT 'Свой склад',
  price_mdl integer,
  stock integer NOT NULL DEFAULT 0,
  lead_days integer,
  created_at text NOT NULL,
  UNIQUE (product_id, supplier)
);
CREATE INDEX IF NOT EXISTS part_offers_product ON part_offers (product_id);

CREATE TABLE IF NOT EXISTS counters (
  name text PRIMARY KEY,
  value integer NOT NULL
);

/* ---------- Страницы сайта ---------- */

CREATE TABLE IF NOT EXISTS site_pages (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title_ru text NOT NULL,
  title_ro text NOT NULL DEFAULT '',
  body_ru text NOT NULL DEFAULT '',
  body_ro text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  seo_title text NOT NULL DEFAULT '',
  seo_description text NOT NULL DEFAULT '',
  visible integer NOT NULL DEFAULT 1,
  show_contacts integer NOT NULL DEFAULT 0,
  placement text NOT NULL DEFAULT 'none',
  in_header integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  seeded integer NOT NULL DEFAULT 0,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS site_pages_order ON site_pages (sort_order);

/* ---------- П2: общий счётчик обращений ---------- */

/* Пределы на формы хранятся в базе, а не в памяти процесса: при нескольких
   рабочих процессах память у каждого своя и общий предел не соблюдается. */
CREATE TABLE IF NOT EXISTS rate_hits (
  bucket text NOT NULL,
  key text NOT NULL,
  at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_hits_lookup ON rate_hits (bucket, key, at);
CREATE INDEX IF NOT EXISTS rate_hits_at ON rate_hits (at);

/* Подтверждение паролем перед сменой ролей и выгрузкой: одноразовые отметки. */
CREATE TABLE IF NOT EXISTS staff_confirmations (
  id bigserial PRIMARY KEY,
  user_id integer NOT NULL,
  scope text NOT NULL,
  at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_confirmations_lookup ON staff_confirmations (user_id, scope, at);

/* ---------- П3: бренд детали отдельно от донора ---------- */

/* Производитель детали (Bosch, Zimmermann, Mercedes-Benz) — не то же самое,
   что машина-донор, с которой её сняли. Старые записи остаются с NULL. */
ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS brand_id text;
CREATE INDEX IF NOT EXISTS catalog_products_brand ON catalog_products (brand_id);

/* Старые адреса карточек: /products/recommended-x ведёт на основную карточку. */
CREATE TABLE IF NOT EXISTS product_redirects (
  old_id text PRIMARY KEY,
  product_id text NOT NULL,
  created_at text NOT NULL
);

/* ---------- П2: журнал только добавляется ---------- */

/* Запись в журнале — доказательство того, кто и что сделал. Приложение её только
   вставляет, но «только по договорённости» — не защита: достаточно одной ошибки
   в новом коде или одного UPDATE из консоли. Правка и удаление запрещены на
   уровне самой базы. Снять запрет можно только осознанно, удалив триггер. */
CREATE OR REPLACE FUNCTION staff_audit_append_only() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Журнал только добавляется: операция % запрещена', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS staff_audit_no_change ON staff_audit;
CREATE TRIGGER staff_audit_no_change
  BEFORE UPDATE OR DELETE OR TRUNCATE ON staff_audit
  FOR EACH STATEMENT EXECUTE FUNCTION staff_audit_append_only();

/* ---------- П5: журнал пустых поисков и подробности заявки ---------- */

-- Журнал пустых поисков (search_misses) уже заведён в db/operations.sql: запрос, машина, время.

-- Заявка «Узнать цену» приходит уже с деталью: оператор не переспрашивает.
-- Старые заявки получают пустые значения и выглядят как раньше.
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS product_id text;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS oem text NOT NULL DEFAULT '';
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS donor text NOT NULL DEFAULT '';
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS search_query text NOT NULL DEFAULT '';

/* ---------- П6: характеристики, кроссы, применимость ---------- */

-- Шаблон характеристик. Привязан к категории (основной или вложенной) и, если нужно,
-- к типу детали. Поля без категории и типа — общие для всех деталей (вес, габариты).
-- Из одного шаблона собираются поля формы в админке, таблица на карточке, фильтры и подсказка названия.
CREATE TABLE IF NOT EXISTS ref_attr_templates (
  id text PRIMARY KEY,
  category_id text REFERENCES ref_categories(id) ON DELETE CASCADE,
  part_type_id text REFERENCES ref_part_types(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label_ru text NOT NULL,
  label_ro text NOT NULL DEFAULT '',
  kind text NOT NULL CHECK (kind IN ('number', 'list', 'text', 'bool')),
  unit text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  filterable boolean NOT NULL DEFAULT false,
  in_name boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ref_attr_templates_scope_key
  ON ref_attr_templates (COALESCE(category_id, ''), COALESCE(part_type_id, ''), key);

-- Значения характеристик. Пустой объект — карточка работает как раньше.
ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS attrs jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS catalog_products_attrs ON catalog_products USING gin (attrs jsonb_path_ops);
-- Отдельные индексы — только по полям, которые реально фильтруют (диаметр диска, ёмкость АКБ, вязкость).
CREATE INDEX IF NOT EXISTS catalog_products_attr_diameter ON catalog_products ((attrs->>'diameter_mm')) WHERE attrs ? 'diameter_mm';
CREATE INDEX IF NOT EXISTS catalog_products_attr_capacity ON catalog_products ((attrs->>'capacity_ah')) WHERE attrs ? 'capacity_ah';
CREATE INDEX IF NOT EXISTS catalog_products_attr_viscosity ON catalog_products ((attrs->>'viscosity')) WHERE attrs ? 'viscosity';

-- Кросс-номера с источником: [{"number":"P50011","source":"Brembo"}].
ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS cross_numbers jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Состояние словами от оператора: «скол на нижнем ухе, стекло целое».
ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS condition_note text NOT NULL DEFAULT '';

-- Новый расходник возврату не подлежит. Флаг стоит на типе детали.
ALTER TABLE ref_part_types ADD COLUMN IF NOT EXISTS consumable integer NOT NULL DEFAULT 0;

-- Применимость к другим машинам. Донор — это происхождение детали, а не обещание,
-- что она подойдёт на другие кузова; такие кузова добавляет оператор с отметкой «проверено».
CREATE TABLE IF NOT EXISTS part_fitments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id text NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  make text NOT NULL,
  model text NOT NULL DEFAULT '',
  generation text NOT NULL DEFAULT '',
  year_from integer,
  year_to integer,
  engine text NOT NULL DEFAULT '',
  verified boolean NOT NULL DEFAULT false,
  verified_by text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS part_fitments_product ON part_fitments (product_id);

-- Сопутствующие категории: к диску — колодки и датчики, к маслу — фильтры.
CREATE TABLE IF NOT EXISTS ref_related_categories (
  category_id text NOT NULL REFERENCES ref_categories(id) ON DELETE CASCADE,
  related_id text NOT NULL REFERENCES ref_categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, related_id)
);

/* ---------- П8: рубль ПМР — основная и единственная валюта ---------- */

-- Журнал однократного перевода цен из леев в рубли ПМР: старая сумма, курс, новая сумма.
-- Колонки *_mdl после перевода хранят рубли ПМР (имена оставлены, чтобы не ломать старые записи и выгрузки).
CREATE TABLE IF NOT EXISTS currency_migration_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text NOT NULL,
  row_id text NOT NULL,
  column_name text NOT NULL,
  old_value integer NOT NULL,
  rate numeric(12,6) NOT NULL,
  new_value integer NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_name, row_id, column_name)
);
