CREATE TABLE IF NOT EXISTS crm_clients (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, phone text UNIQUE NOT NULL, name text NOT NULL DEFAULT '',
 email text NOT NULL DEFAULT '', kind text NOT NULL DEFAULT 'private' CHECK(kind IN ('private','sto','reseller')),
 discount integer NOT NULL DEFAULT 0 CHECK(discount BETWEEN 0 AND 100), tags text NOT NULL DEFAULT '',
 notes text NOT NULL DEFAULT '', vehicles text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_cases (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, client_id integer NOT NULL REFERENCES crm_clients(id),
 need text NOT NULL, source text NOT NULL, stage text NOT NULL DEFAULT 'new' CHECK(stage IN ('new','working','offered','waiting','issued','refused')),
 refusal text NOT NULL DEFAULT '', owner_id integer REFERENCES staff_users(id) ON DELETE SET NULL,
 order_id integer REFERENCES orders(id) ON DELETE SET NULL, inquiry_id integer REFERENCES inquiries(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS crm_phone_aliases(phone text PRIMARY KEY,client_id integer NOT NULL REFERENCES crm_clients(id));
CREATE UNIQUE INDEX IF NOT EXISTS crm_case_order ON crm_cases(order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_case_inquiry ON crm_cases(inquiry_id) WHERE inquiry_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS crm_events (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, client_id integer NOT NULL REFERENCES crm_clients(id),
 case_id integer REFERENCES crm_cases(id), actor text NOT NULL, title text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crm_tasks (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, case_id integer NOT NULL REFERENCES crm_cases(id),
 owner_id integer NOT NULL REFERENCES staff_users(id), title text NOT NULL, due_at timestamptz NOT NULL,
 done boolean NOT NULL DEFAULT false, reminded boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_task_due ON crm_tasks(due_at) WHERE NOT done;
CREATE TABLE IF NOT EXISTS crm_waits (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, case_id integer NOT NULL REFERENCES crm_cases(id),
 query text NOT NULL, category_id text, donor_id text, notified_product text, active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS operations_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, kind text NOT NULL, entity_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
CREATE TABLE IF NOT EXISTS telegram_links (
 staff_id integer PRIMARY KEY REFERENCES staff_users(id) ON DELETE CASCADE, user_id text UNIQUE NOT NULL, chat_id text UNIQUE NOT NULL,
 pending jsonb, linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS telegram_invites (
 token_hash text PRIMARY KEY, staff_id integer NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, used_at timestamptz
);
CREATE TABLE IF NOT EXISTS telegram_updates (
 id bigint PRIMARY KEY, payload jsonb NOT NULL, processed_at timestamptz, error text, attempts integer NOT NULL DEFAULT 0,
 next_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS telegram_messages (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, chat_id text NOT NULL, message_id integer NOT NULL,
 kind text NOT NULL, entity_id text NOT NULL, UNIQUE(chat_id,message_id)
);
CREATE TABLE IF NOT EXISTS telegram_outbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, dedupe text UNIQUE NOT NULL, method text NOT NULL, payload jsonb NOT NULL,
 kind text, entity_id text, attempts integer NOT NULL DEFAULT 0, next_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, error text
);
CREATE INDEX IF NOT EXISTS telegram_outbox_pending ON telegram_outbox(next_at) WHERE sent_at IS NULL;
CREATE TABLE IF NOT EXISTS telegram_state (key text PRIMARY KEY, value text NOT NULL);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cost_agreed boolean;
ALTER TABLE telegram_links ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE telegram_links ADD COLUMN IF NOT EXISTS notify_orders boolean NOT NULL DEFAULT true;
ALTER TABLE telegram_links ADD COLUMN IF NOT EXISTS notify_inquiries boolean NOT NULL DEFAULT true;
ALTER TABLE telegram_links ADD COLUMN IF NOT EXISTS notify_tasks boolean NOT NULL DEFAULT true;
ALTER TABLE telegram_links ADD COLUMN IF NOT EXISTS notify_stock boolean NOT NULL DEFAULT true;
ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS telegram_username text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS vacancies (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text NOT NULL, description text NOT NULL DEFAULT '', schedule text NOT NULL DEFAULT '', location text NOT NULL DEFAULT '', image text NOT NULL DEFAULT '', is_open boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS vacancy_applications (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, vacancy_id integer REFERENCES vacancies(id), vacancy_title text NOT NULL, name text NOT NULL, phone text NOT NULL, messenger text NOT NULL DEFAULT '', about text NOT NULL DEFAULT '', stage text NOT NULL DEFAULT 'new' CHECK(stage IN ('new','contacted','interview','hired','refused')), notes text NOT NULL DEFAULT '', task text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS news_articles (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, slug text NOT NULL UNIQUE, title_ru text NOT NULL, title_ro text NOT NULL DEFAULT '', body_ru text NOT NULL, body_ro text NOT NULL DEFAULT '', image text NOT NULL DEFAULT '', topic text NOT NULL, published boolean NOT NULL DEFAULT false, published_at timestamptz NOT NULL DEFAULT now(), product_ids text[] NOT NULL DEFAULT '{}');
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS inline_image text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS product_reviews (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, product_id text NOT NULL DEFAULT '', name text NOT NULL, phone text NOT NULL, rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5), body text NOT NULL, photo text NOT NULL DEFAULT '', reply text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','hidden')), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(product_id,phone));
CREATE TABLE IF NOT EXISTS ad_banners (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, advertiser text NOT NULL, phone text NOT NULL, image text NOT NULL, url text NOT NULL, placement text NOT NULL CHECK(placement IN ('catalog','article','footer','product')), start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, price_mdl integer NOT NULL DEFAULT 0 CHECK(price_mdl>=0), enabled boolean NOT NULL DEFAULT false, report_token text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS ad_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,banner_id integer NOT NULL REFERENCES ad_banners(id) ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN ('view','click')),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ad_events_banner ON ad_events(banner_id,created_at);
CREATE TABLE IF NOT EXISTS search_misses (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 query text NOT NULL,
 vehicle text NOT NULL DEFAULT '',
 requested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_misses_requested ON search_misses(requested_at DESC);
CREATE TABLE IF NOT EXISTS ad_slot_settings (placement text PRIMARY KEY CHECK(placement IN ('catalog','article','footer','product')), price_mdl integer CHECK(price_mdl IS NULL OR price_mdl>=0));
ALTER TABLE ad_banners DROP CONSTRAINT IF EXISTS ad_banners_placement_check;
ALTER TABLE ad_banners ADD CONSTRAINT ad_banners_placement_check CHECK (placement IN ('home','catalog','article','footer','product'));
ALTER TABLE ad_slot_settings DROP CONSTRAINT IF EXISTS ad_slot_settings_placement_check;
ALTER TABLE ad_slot_settings ADD CONSTRAINT ad_slot_settings_placement_check CHECK (placement IN ('home','catalog','article','footer','product'));

CREATE OR REPLACE FUNCTION crm_phone(raw text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN regexp_replace(raw,'\D','','g') LIKE '373%' THEN '+' || regexp_replace(regexp_replace(raw,'\D','','g'),'^3730','373')
 WHEN raw LIKE '+%' THEN '+' || regexp_replace(raw,'\D','','g') ELSE '+373' || regexp_replace(regexp_replace(raw,'\D','','g'),'^0+','') END
$$;
CREATE OR REPLACE FUNCTION crm_capture() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid integer; caseid integer; label text; src text; target integer;
BEGIN
 IF TG_TABLE_NAME='orders' THEN label := 'Заказ № ' || (NEW.id+1000); src := NEW.source; ELSE label:=NEW.part || ' ' || NEW.vehicle; src:=NEW.source; END IF;
 SELECT client_id INTO cid FROM crm_phone_aliases WHERE phone=crm_phone(NEW.phone);
 IF cid IS NULL THEN INSERT INTO crm_clients(phone,name) VALUES(crm_phone(NEW.phone),CASE WHEN TG_TABLE_NAME='orders' THEN to_jsonb(NEW)->>'name' ELSE '' END)
 ON CONFLICT(phone) DO UPDATE SET name=CASE WHEN crm_clients.name='' THEN EXCLUDED.name ELSE crm_clients.name END RETURNING id INTO cid;
 END IF;
 IF TG_TABLE_NAME='orders' THEN
   SELECT id INTO caseid FROM crm_cases WHERE order_id=NEW.id;
 ELSE SELECT id INTO caseid FROM crm_cases WHERE inquiry_id=NEW.id; END IF;
 IF caseid IS NULL THEN
   SELECT id INTO caseid FROM crm_cases WHERE client_id=cid AND stage NOT IN ('issued','refused') AND
    CASE WHEN TG_TABLE_NAME='orders' THEN order_id IS NULL ELSE inquiry_id IS NULL END ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
   IF caseid IS NULL THEN INSERT INTO crm_cases(client_id,need,source) VALUES(cid,label,src) RETURNING id INTO caseid; END IF;
   IF TG_TABLE_NAME='orders' THEN UPDATE crm_cases SET order_id=NEW.id,updated_at=now() WHERE id=caseid;
   ELSE UPDATE crm_cases SET inquiry_id=NEW.id,updated_at=now() WHERE id=caseid; END IF;
 END IF;
 IF TG_OP='INSERT' OR (TG_TABLE_NAME='orders' AND to_jsonb(OLD)->>'status' IS DISTINCT FROM to_jsonb(NEW)->>'status') THEN
   INSERT INTO crm_events(client_id,case_id,actor,title,detail) VALUES(cid,caseid,'Система',label,COALESCE(to_jsonb(NEW)->>'status','new'));
   INSERT INTO operations_events(kind,entity_id) VALUES(TG_TABLE_NAME,NEW.id::text);
 END IF;
 IF TG_TABLE_NAME='orders' AND to_jsonb(NEW)->>'status'='issued' THEN
  UPDATE crm_cases SET stage='issued',version=version+1,updated_at=now() WHERE id=caseid AND stage<>'issued';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_crm ON orders;
CREATE TRIGGER orders_crm AFTER INSERT OR UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION crm_capture();
DROP TRIGGER IF EXISTS inquiries_crm ON inquiries;
CREATE TRIGGER inquiries_crm AFTER INSERT OR UPDATE OF status ON inquiries FOR EACH ROW EXECUTE FUNCTION crm_capture();
CREATE OR REPLACE FUNCTION stock_capture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 UPDATE part_offers SET stock=NEW.stock,price_mdl=NEW.price_mdl WHERE product_id=NEW.id AND supplier='own';
 IF NEW.stock>0 AND NEW.hidden=0 AND (TG_OP='INSERT' OR OLD.stock=0) THEN INSERT INTO operations_events(kind,entity_id) VALUES('stock',NEW.id); END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS stock_crm ON catalog_products;
CREATE TRIGGER stock_crm AFTER INSERT OR UPDATE OF stock ON catalog_products FOR EACH ROW EXECUTE FUNCTION stock_capture();
UPDATE orders SET status=status WHERE NOT EXISTS(SELECT 1 FROM crm_cases WHERE order_id=orders.id);
UPDATE inquiries SET status=status WHERE NOT EXISTS(SELECT 1 FROM crm_cases WHERE inquiry_id=inquiries.id);
