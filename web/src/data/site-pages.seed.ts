// Стартовый текст страниц. Это заглушка, которую владелец правит в «Сайт → Страницы» без программиста.
// Разметка простая: «## » — подзаголовок, «- » — пункт списка, пустая строка — новый абзац.
// Цифры и условия взяты из описания работы разборки, ничего не придумано: часы, адрес, телефоны,
// оплата при получении или переводом, невозврат двигателей и КПП.

export type PagePlacement = "nav" | "header" | "footer-company" | "footer-buyer" | "none";

export type SitePageSeed = {
  slug: string;
  titleRu: string;
  titleRo: string;
  bodyRu: string;
  bodyRo: string;
  image: string;
  seoTitle: string;
  seoDescription: string;
  showContacts: boolean;
  placement: PagePlacement;
  inHeader: boolean;
};

export const sitePagesSeed: SitePageSeed[] = [
  {
    slug: "delivery",
    titleRu: "Доставка",
    titleRo: "Livrare",
    image: "/images/banners/maintenance-kit-wide.png",
    seoTitle: "Доставка запчастей по ПМР и Молдове — NAA.md",
    seoDescription: "Самовывоз в Слободзее, доставка до 20 км по договорённости, дальше маршруткой или курьерской службой. Стоимость называет оператор.",
    inHeader: true,
    showContacts: true,
    placement: "footer-buyer",
    bodyRu: `Забрать деталь можно самому или договориться о доставке. Точную стоимость доставки называет оператор, когда подтверждает заказ: она зависит от веса детали, расстояния и перевозчика.

## Самовывоз
Слободзея, ул. Новосовицкая 25. Точка работает с 9:00 до 18:00. Деталь лежит на складе — приезжайте и забирайте, предварительно позвоните, чтобы её достали и подготовили к осмотру.

## До 20 км — по договорённости
Слободзея и соседние села: привезём сами, время и условия обсуждаем по телефону. Крупные узлы — двигатель, коробку, двери — согласовываем отдельно: нужна машина с багажником подходящего размера.

## Дальше — маршруткой или службой доставки
По ПМР и Молдове отправляем попутной маршруткой или курьерской службой. Доставка платная, сумму называет оператор до отправки. Отправляем только после того, как вы подтвердили заказ и способ оплаты.

## Как это выглядит по шагам
- Вы оформляете заказ на сайте или звоните.
- Оператор проверяет наличие и перезванивает с 8:00 до 20:00.
- Вместе выбираете способ получения и считаете стоимость доставки.
- Деталь уезжает к вам или ждёт на складе.

Онлайн-оплаты на сайте нет. Платить можно при получении или переводом после подтверждения заказа.`,
    bodyRo: `Puteți ridica piesa personal sau puteți conveni livrarea. Costul exact al livrării îl comunică operatorul la confirmarea comenzii: depinde de greutatea piesei, de distanță și de transportator.

## Ridicare personală
Slobozia, str. Novosavițkaia 25. Punctul lucrează de la 9:00 până la 18:00. Piesa este la depozit — sunați înainte, ca să fie scoasă și pregătită pentru examinare.

## Până la 20 km — prin înțelegere
Slobozia și satele vecine: aducem noi, ora și condițiile le discutăm la telefon. Agregatele mari — motor, cutie de viteze, uși — le convenim separat: este nevoie de o mașină cu portbagaj potrivit.

## Mai departe — cu maxi-taxi sau curier
În Transnistria și în Moldova expediem cu maxi-taxi sau prin serviciu de curierat. Livrarea se plătește, suma o comunică operatorul înainte de expediere. Expediem doar după ce ați confirmat comanda și modul de plată.

## Pe pași
- Plasați comanda pe site sau sunați.
- Operatorul verifică stocul și vă sună de la 8:00 până la 20:00.
- Alegeți împreună modul de primire și calculați costul livrării.
- Piesa pleacă spre dumneavoastră sau vă așteaptă la depozit.

Pe site nu există plată online. Puteți plăti la primire sau prin transfer după confirmarea comenzii.`,
  },
  {
    slug: "payment",
    titleRu: "Оплата",
    titleRo: "Plata",
    image: "/images/categories/fasteners.png",
    seoTitle: "Способы оплаты запчастей — NAA.md",
    seoDescription: "Оплата при получении или переводом после подтверждения заказа оператором. Цены в рублях ПМР. Онлайн-оплаты нет.",
    inHeader: false,
    showContacts: true,
    placement: "footer-buyer",
    bodyRu: `Платить на сайте не нужно: сначала оператор подтверждает наличие и итоговую сумму, и только потом вы платите.

## При получении
Самый простой способ. Забираете деталь на складе или у курьера, осматриваете её и платите на месте.

## Переводом после подтверждения
Если деталь едет к вам маршруткой или службой доставки, оператор присылает реквизиты после подтверждения заказа. Отправляем после поступления оплаты.

## Валюты
Все цены на сайте — в рублях ПМР. Точную сумму оператор подтверждает по телефону.

## Чего на сайте нет
- Нет оплаты картой на сайте.
- Нет рассрочки и кредита.
- Не просим предоплату до разговора с оператором.

На покупку даём товарный чек: номер заказа, список деталей, суммы, способ оплаты и получения. Вопрос фискального чека и кассового аппарата решается по правилам ПМР отдельно — уточните у оператора, если он нужен для бухгалтерии.`,
    bodyRo: `Nu trebuie să plătiți pe site: mai întâi operatorul confirmă stocul și suma finală, abia apoi plătiți.

## La primire
Cel mai simplu. Ridicați piesa de la depozit sau de la curier, o examinați și plătiți pe loc.

## Prin transfer după confirmare
Dacă piesa vine la dumneavoastră cu maxi-taxi sau prin curier, operatorul trimite datele de plată după confirmarea comenzii. Expediem după încasare.

## Valute
Prețurile sunt în lei (MDL). Dacă proprietarul a indicat cursul, afișăm alături suma în ruble transnistrene — este o conversie informativă după cursul magazinului, nu un preț separat.

## Ce nu există pe site
- Nu există plată cu cardul pe site.
- Nu există rate sau credit.
- Nu cerem avans înainte de discuția cu operatorul.

Pentru cumpărare eliberăm un bon de marfă: numărul comenzii, lista pieselor, sumele, modul de plată și de primire. Chestiunea bonului fiscal se rezolvă separat, după regulile din Transnistria — întrebați operatorul dacă vă trebuie pentru contabilitate.`,
  },
  {
    slug: "returns",
    titleRu: "Возврат",
    titleRo: "Retur",
    image: "/images/categories/engine.png",
    seoTitle: "Условия возврата запчастей — NAA.md",
    seoDescription: "Возврат деталей с сохранёнными метками и наклейками, в исходном состоянии. Двигатели, коробки и агрегаты возврату не подлежат.",
    inHeader: false,
    showContacts: true,
    placement: "footer-buyer",
    bodyRu: `Деталь с разборки — не новый товар в коробке, поэтому у возврата есть понятные границы. Прочитайте их до покупки, чтобы потом не было неожиданностей.

## Что можно вернуть
- Деталь в том же состоянии, в котором вы её забрали.
- Метки и наклейки магазина на месте и не повреждены.
- Деталь не ставили на автомобиль или ставили аккуратно, без следов вмешательства.

## Что вернуть нельзя
- Двигатели, коробки передач и агрегаты в сборе — возврату не подлежат.
- Деталь, которую повредили при установке или перевозке. Здесь возможен частичный возврат или отказ — решаем по результатам осмотра.
- Деталь, которую вы выбрали вопреки рекомендации подборщика. Если оператор предупредил, что она не подойдёт, а вы настояли — возврата не будет. Такой выбор мы отмечаем в заказе.
- Деталь без меток и наклеек магазина: мы не можем подтвердить, что она наша.

## Осмотр при выдаче
Осматривайте деталь при получении, вместе с сотрудником. Мы делаем фото при выдаче и прикладываем его к заказу — это защищает и вас, и нас.

## Как оформить возврат
- Позвоните оператору с 8:00 до 20:00 и назовите номер заказа.
- Привезите деталь на склад: Слободзея, ул. Новосовицкая 25, с 9:00 до 18:00.
- Сотрудник осматривает деталь и фотографирует её.
- Решение — полный возврат, частичный или отказ — объясняем и фиксируем с причиной.

_Текст об условиях возврата проверяет юрист. Окончательные формулировки могут быть уточнены._`,
    bodyRo: `O piesă de la dezmembrări nu este marfă nouă în cutie, de aceea returul are limite clare. Citiți-le înainte de cumpărare.

## Ce se poate returna
- Piesa în aceeași stare în care ați ridicat-o.
- Marcajele și etichetele magazinului intacte.
- Piesa nu a fost montată pe automobil sau a fost montată cu grijă, fără urme de intervenție.

## Ce nu se returnează
- Motoarele, cutiile de viteze și agregatele complete nu se returnează.
- Piesa deteriorată la montaj sau la transport. Aici este posibil retur parțial sau refuz — decidem după examinare.
- Piesa aleasă contrar recomandării consultantului. Dacă operatorul a avertizat că nu se potrivește, iar dumneavoastră ați insistat, returul nu se face. Notăm această alegere în comandă.
- Piesa fără marcajele și etichetele magazinului: nu putem confirma că este a noastră.

## Examinarea la predare
Examinați piesa la primire, împreună cu angajatul. Facem o fotografie la predare și o atașăm comenzii — asta vă protejează și pe dumneavoastră, și pe noi.

## Cum se face returul
- Sunați operatorul între 8:00 și 20:00 și spuneți numărul comenzii.
- Aduceți piesa la depozit: Slobozia, str. Novosavițkaia 25, între 9:00 și 18:00.
- Angajatul examinează piesa și o fotografiază.
- Decizia — retur integral, parțial sau refuz — este explicată și consemnată cu motivul.

_Textul despre condițiile de retur este verificat de jurist. Formulările finale pot fi precizate._`,
  },
  {
    slug: "warranty",
    titleRu: "Гарантия",
    titleRo: "Garanție",
    image: "/images/categories/brakes.png",
    seoTitle: "Гарантия на детали с разборки — NAA.md",
    seoDescription: "Что мы гарантируем на б/у детали и новые расходники, как проверить деталь при получении и что делать, если она не подошла.",
    inHeader: false,
    showContacts: true,
    placement: "footer-buyer",
    bodyRu: `Мы продаём два разных товара, и гарантия у них разная.

## Детали с разборки
Это б/у детали со снятых машин. Мы гарантируем, что деталь — та самая, что на фото и в описании, и что её состояние соответствует указанному. Срок гарантии и её условия оператор называет при подтверждении заказа: он зависит от детали и её состояния.

## Новые расходники
Фильтры, масла, прокладки и прочие новые детали идут с гарантией производителя. Чек сохраняйте: без него подтвердить покупку сложнее.

## Что проверить при получении
- Деталь целая, без новых трещин и сколов.
- Номер и бирка совпадают с тем, что указано в заказе.
- Посадочные места, резьба и разъёмы не сорваны.
- Метки и наклейки магазина на месте — они нужны для возврата.

## Что гарантией не закрывается
- Двигатели, коробки и агрегаты в сборе — на них возврата нет, это отдельно оговаривается в заказе.
- Поломка из-за неправильной установки.
- Деталь, выбранная вопреки рекомендации подборщика.
- Естественный износ б/у детали за пределами заявленного состояния.

Если деталь не подошла, звоните оператору с 8:00 до 20:00: разберёмся по заказу и по фото выдачи.

_Текст о гарантии проверяет юрист. Окончательные формулировки могут быть уточнены._`,
    bodyRo: `Vindem două tipuri de marfă, iar garanția este diferită.

## Piese de la dezmembrări
Sunt piese folosite, scoase de pe automobile. Garantăm că piesa este exact cea din fotografie și din descriere și că starea ei corespunde celei indicate. Termenul de garanție și condițiile le comunică operatorul la confirmarea comenzii: depind de piesă și de starea ei.

## Consumabile noi
Filtrele, uleiurile, garniturile și alte piese noi au garanția producătorului. Păstrați bonul: fără el este mai greu de confirmat cumpărarea.

## Ce să verificați la primire
- Piesa este întreagă, fără fisuri și ciobituri noi.
- Numărul și eticheta corespund cu cele din comandă.
- Locurile de montaj, filetul și conectorii nu sunt rupte.
- Marcajele și etichetele magazinului sunt la locul lor — sunt necesare pentru retur.

## Ce nu acoperă garanția
- Motoarele, cutiile și agregatele complete — pentru ele nu există retur, se stipulează separat în comandă.
- Defectarea din cauza montajului greșit.
- Piesa aleasă contrar recomandării consultantului.
- Uzura naturală a unei piese folosite, în limita stării declarate.

Dacă piesa nu s-a potrivit, sunați operatorul între 8:00 și 20:00.

_Textul despre garanție este verificat de jurist. Formulările finale pot fi precizate._`,
  },
  {
    slug: "contacts",
    titleRu: "Контакты",
    titleRo: "Contacte",
    image: "",
    seoTitle: "Контакты NAA.md — Слободзея, ул. Новосовицкая 25",
    seoDescription: "Адрес склада, часы работы точки и оператора, телефоны ПМР и Молдовы, Viber и Telegram.",
    inHeader: true,
    showContacts: true,
    placement: "none",
    bodyRu: `Звоните, пишите в Viber или Telegram, приезжайте на склад. Оператор отвечает с 8:00 до 20:00 — без автоответчиков и ботов, отвечает человек.

## Как лучше связаться
- Нужна деталь, которой нет в каталоге — звоните: мы знаем, что лежит на складе, и посмотрим по машинам-донорам.
- Хотите показать фото сломанной детали — Viber или Telegram.
- Приехать посмотреть деталь вживую — приезжайте в часы работы точки, но позвоните заранее, чтобы её достали.

## Когда мы отвечаем, а когда работает точка
Оператор на телефоне с 8:00 до 20:00. Склад и точка выдачи открыты с 9:00 до 18:00. Это разные часы: позвонить можно раньше и позже, а забрать деталь — только когда открыт склад.`,
    bodyRo: `Sunați, scrieți pe Viber sau Telegram, veniți la depozit. Operatorul răspunde între 8:00 și 20:00 — fără roboți, răspunde o persoană.

## Cum e mai bine să ne contactați
- Vă trebuie o piesă care nu este în catalog — sunați: știm ce avem la depozit și verificăm pe automobilele donatoare.
- Vreți să arătați o fotografie a piesei defecte — Viber sau Telegram.
- Vreți să vedeți piesa pe viu — veniți în orele de lucru ale punctului, dar sunați înainte.

## Când răspundem și când lucrează punctul
Operatorul este la telefon între 8:00 și 20:00. Depozitul și punctul de predare sunt deschise între 9:00 și 18:00. Sunt ore diferite: puteți suna mai devreme sau mai târziu, dar piesa o ridicați doar când depozitul este deschis.`,
  },
  {
    slug: "about",
    titleRu: "О компании",
    titleRo: "Despre companie",
    image: "/images/team/parts-expert.png",
    seoTitle: "О компании NAA.md — разборка в Слободзее",
    seoDescription: "Разборка автомобилей в Слободзее: детали примерно с 150 машин-доноров, новые расходники, подбор по марке и модели.",
    inHeader: true,
    showContacts: true,
    placement: "footer-company",
    bodyRu: `NAA.md — разборка автомобилей в Слободзее. Мы разбираем машины и продаём с них детали, а рядом держим новые расходники, которые чаще всего нужны вместе с б/у деталью.

## Что у нас есть
- Детали примерно с 150 машин-доноров. Многие машины стоят в сборе — можно взять мотор или коробку целиком.
- Новые расходники: фильтры, прокладки, масла и прочее, что меняют заодно.
- Знание того, что лежит на складе. Если детали нет в каталоге — спросите, часто она есть, просто ещё не выложена.

## Как мы работаем
Вы находите деталь в каталоге или звоните. Оператор проверяет наличие и состояние, называет итог и способ получения. Платите при получении или переводом после подтверждения — предоплату до разговора мы не просим.

## Где мы работаем
ПМР и Молдова. Самовывоз в Слободзее, доставка до 20 км по договорённости, дальше — маршруткой или службой доставки. Говорим по-русски и по-румынски.

## Чего мы не делаем
- Не подбираем по VIN и госномеру: такого поиска у нас нет.
- Не обещаем «ответ за 15 минут» и круглосуточную работу. Оператор отвечает с 8:00 до 20:00.
- Не продаём детали, состояние которых не видели сами.`,
    bodyRo: `NAA.md este o dezmembrare auto în Slobozia. Dezmembrăm automobile și vindem piese de pe ele, iar alături ținem consumabile noi, care sunt cel mai des necesare împreună cu o piesă folosită.

## Ce avem
- Piese de pe aproximativ 150 de automobile donatoare. Multe mașini sunt întregi — se poate lua motorul sau cutia complet.
- Consumabile noi: filtre, garnituri, uleiuri și tot ce se schimbă odată cu piesa.
- Știm ce este la depozit. Dacă piesa nu este în catalog, întrebați: deseori există, doar nu a fost încă publicată.

## Cum lucrăm
Găsiți piesa în catalog sau sunați. Operatorul verifică stocul și starea, comunică totalul și modul de primire. Plătiți la primire sau prin transfer după confirmare — avans înainte de discuție nu cerem.

## Unde lucrăm
Transnistria și Moldova. Ridicare personală în Slobozia, livrare până la 20 km prin înțelegere, mai departe cu maxi-taxi sau serviciu de curierat. Vorbim rusește și românește.

## Ce nu facem
- Nu selectăm după VIN sau număr de înmatriculare: această căutare nu există la noi.
- Nu promitem „răspuns în 15 minute" și lucru non-stop. Operatorul răspunde între 8:00 și 20:00.
- Nu vindem piese a căror stare nu am văzut-o personal.`,
  },
  {
    slug: "autoservice",
    titleRu: "Автосервис",
    titleRo: "Service auto",
    image: "/images/banners/autoservice-banner.png",
    seoTitle: "Автосервис в Слободзее — NAA.md",
    seoDescription: "Поможем поставить деталь, купленную на разборке. Запись и стоимость — по телефону, оператор отвечает с 8:00 до 20:00.",
    inHeader: false,
    showContacts: true,
    placement: "nav",
    bodyRu: `Купили деталь и нужен кто-то, кто её поставит — звоните. Договариваемся по телефону: смотрим, что за работа, называем срок и стоимость.

## Чем помогаем
- Поставить деталь, купленную у нас.
- Посмотреть, та ли деталь нужна, пока машина на подъёмнике.
- Снять с вашей машины узел, который вы хотите продать или заменить.

## Как записаться
Только по телефону. Оператор отвечает с 8:00 до 20:00, работы ведутся в часы работы точки — с 9:00 до 18:00. Онлайн-записи и расчёта стоимости на сайте нет: цена зависит от машины и от того, что реально придётся делать.

Заранее скажите марку, модель, год и что нужно сделать — так разговор будет короче.`,
    bodyRo: `Ați cumpărat o piesă și aveți nevoie de cineva să o monteze — sunați. Ne înțelegem la telefon: vedem despre ce lucrare este vorba, spunem termenul și costul.

## Cu ce ajutăm
- Montăm piesa cumpărată la noi.
- Verificăm dacă este chiar piesa necesară, cât timp mașina este pe elevator.
- Demontăm de pe mașina dumneavoastră agregatul pe care vreți să îl vindeți sau să îl schimbați.

## Cum vă programați
Doar la telefon. Operatorul răspunde între 8:00 și 20:00, lucrările se fac în orele punctului — între 9:00 și 18:00. Programare online și calcul de preț pe site nu există: prețul depinde de mașină și de ce trebuie făcut efectiv.

Spuneți din start marca, modelul, anul și ce trebuie făcut.`,
  },
  {
    slug: "russification",
    titleRu: "Русификация",
    titleRo: "Rusificare",
    image: "/images/categories/interior.png",
    seoTitle: "Русификация магнитолы и приборной панели — NAA.md",
    seoDescription: "Русское меню в штатной магнитоле и приборной панели. Срок и стоимость — по телефону, оператор отвечает с 8:00 до 20:00.",
    inHeader: false,
    showContacts: true,
    placement: "nav",
    bodyRu: `Машина пришла из-за границы и меню в магнитоле не на русском — поможем. Делаем русское меню в штатной магнитоле и приборной панели.

## Что обычно просят
- Русское меню в штатной магнитоле.
- Русский язык в приборной панели и бортовом компьютере.
- Голосовые подсказки навигации на русском, если машина их поддерживает.

## Что нужно знать заранее
Не каждую машину можно русифицировать: это зависит от марки, года и конкретной прошивки. Поэтому сначала звонок: называете марку, модель, год и что за магнитола, и мы говорим, берёмся или нет.

Срок и стоимость называем по телефону. Онлайн-расчёта на сайте нет. Оператор отвечает с 8:00 до 20:00, работы — в часы работы точки, с 9:00 до 18:00.`,
    bodyRo: `Mașina a venit din străinătate și meniul casetofonului nu este în rusă — vă ajutăm. Facem meniu rusesc în casetofonul din fabrică și în tabloul de bord.

## Ce se cere de obicei
- Meniu rusesc în casetofonul din fabrică.
- Limba rusă în tabloul de bord și în computerul de bord.
- Indicații vocale de navigație în rusă, dacă mașina le suportă.

## Ce trebuie știut din start
Nu orice mașină poate fi rusificată: depinde de marcă, de an și de firmware. De aceea mai întâi un telefon: spuneți marca, modelul, anul și ce casetofon este, iar noi vă spunem dacă ne ocupăm.

Termenul și costul le comunicăm la telefon. Calcul online pe site nu există. Operatorul răspunde între 8:00 și 20:00, lucrările — între 9:00 și 18:00.`,
  },
  {
    slug: "cars",
    titleRu: "Автомобили в наличии",
    titleRo: "Automobile disponibile",
    image: "/images/hero/mercedes-sedan-parts.png",
    seoTitle: "Продажа автомобилей — NAA.md, Слободзея",
    seoDescription: "Машины на продажу целиком и машины-доноры. Состояние и цену называет оператор по телефону.",
    inHeader: false,
    showContacts: true,
    placement: "nav",
    bodyRu: `Иногда машина уходит целиком, а не по деталям. Такие машины стоят у нас на площадке, и их можно купить.

## Какие машины бывают
- Машины на ходу — можно посмотреть и послушать.
- Машины на запчасти — целые, но не на ходу: берут ради мотора, коробки или кузовных деталей.
- Машины после разборки — остатки кузова и то, что ещё не снято.

## Как купить
Позвоните и скажите, что ищете: марку, бюджет, на ходу или на запчасти. Оператор скажет, что есть сейчас, в каком состоянии и сколько стоит. Приезжайте смотреть в часы работы точки, с 9:00 до 18:00.

Список машин на этой странице владелец ведёт вручную. Актуальное наличие всегда уточняйте по телефону — машины уходят быстро.`,
    bodyRo: `Uneori o mașină pleacă întreagă, nu pe piese. Astfel de mașini sunt la noi în parcare și pot fi cumpărate.

## Ce mașini sunt
- Mașini funcționale — se pot vedea și asculta.
- Mașini pentru piese — întregi, dar nefuncționale: se iau pentru motor, cutie sau piese de caroserie.
- Mașini după dezmembrare — ce a rămas din caroserie și ce nu a fost încă demontat.

## Cum se cumpără
Sunați și spuneți ce căutați: marca, bugetul, funcțională sau pentru piese. Operatorul vă spune ce este acum, în ce stare și cât costă. Veniți să vedeți între 9:00 și 18:00.

Lista mașinilor de pe această pagină este ținută manual de proprietar. Disponibilitatea curentă se verifică la telefon — mașinile pleacă repede.`,
  },
  {
    slug: "carwash",
    titleRu: "Автомойка",
    titleRo: "Spălătorie auto",
    image: "/images/posts/tires.png",
    seoTitle: "Автомойка в Слободзее — NAA.md",
    seoDescription: "Мойка кузова и салона рядом со складом запчастей. Запись и цена — по телефону.",
    inHeader: false,
    showContacts: true,
    placement: "none",
    bodyRu: `Моем кузов и салон. Удобно, если машина уже приехала к нам за деталью или на работы.

## Что делаем
- Мойка кузова снаружи.
- Уборка салона: пылесос, панель, стёкла.
- Мойка двигательного отсека — по согласованию, не на каждой машине.

## Как записаться
По телефону, оператор отвечает с 8:00 до 20:00. Моем в часы работы точки, с 9:00 до 18:00. Цена зависит от машины и от того, насколько она грязная — называем по телефону или на месте. Онлайн-записи и прайса на сайте нет.`,
    bodyRo: `Spălăm caroseria și interiorul. Comod, dacă mașina a venit oricum la noi după o piesă sau pentru lucrări.

## Ce facem
- Spălarea exterioară a caroseriei.
- Curățarea interiorului: aspirator, bord, geamuri.
- Spălarea compartimentului motor — prin acord, nu pe orice mașină.

## Cum vă programați
La telefon, operatorul răspunde între 8:00 și 20:00. Spălăm între 9:00 și 18:00. Prețul depinde de mașină și de cât de murdară este — îl spunem la telefon sau pe loc. Programare online și listă de prețuri pe site nu există.`,
  },
  {
    slug: "promotions",
    titleRu: "Акции",
    titleRo: "Promoții",
    image: "/images/banners/maintenance-kit.png",
    seoTitle: "Акции и скидки на запчасти — NAA.md",
    seoDescription: "Действующие предложения разборки NAA.md. Условия каждой акции владелец ведёт вручную.",
    inHeader: false,
    showContacts: false,
    placement: "nav",
    bodyRu: `Здесь собраны действующие предложения. Страницу ведёт владелец: когда акция заканчивается, он её убирает.

## Что бывает
- Скидка на детали с конкретной машины-донора, когда её нужно разобрать быстрее.
- Комплект вместо одной детали: взять пару или узел в сборе выгоднее, чем по отдельности.
- Новые расходники со скидкой при покупке б/у детали — фильтр или прокладку к мотору.

## Как узнать об акции
Спросите у оператора при подтверждении заказа: он видит склад и скажет, попадает ли ваша деталь под предложение.

Сейчас активных акций может не быть — это нормально. Предложения появляются, когда на склад попадает подходящая машина.`,
    bodyRo: `Aici sunt ofertele în vigoare. Pagina este ținută de proprietar: când promoția se încheie, o scoate.

## Ce poate fi
- Reducere la piesele de pe un anumit automobil donator, când trebuie dezmembrat mai repede.
- Set în loc de o singură piesă: o pereche sau un agregat complet este mai avantajos decât separat.
- Consumabile noi cu reducere la cumpărarea unei piese folosite — un filtru sau o garnitură pentru motor.

## Cum aflați despre promoție
Întrebați operatorul la confirmarea comenzii: el vede depozitul și vă spune dacă piesa dumneavoastră intră în ofertă.

Acum s-ar putea să nu existe promoții active — este normal. Ofertele apar când la depozit ajunge o mașină potrivită.`,
  },
  {
    slug: "privacy",
    titleRu: "Политика конфиденциальности",
    titleRo: "Politica de confidențialitate",
    image: "",
    seoTitle: "Политика конфиденциальности — NAA.md",
    seoDescription: "Какие данные собирает сайт NAA.md, зачем они нужны и как их удалить.",
    inHeader: false,
    showContacts: true,
    placement: "footer-company",
    bodyRu: `Мы собираем ровно столько данных, сколько нужно, чтобы довезти до вас деталь.

## Что мы просим
- Имя и телефон — чтобы оператор перезвонил и подтвердил заказ.
- Адрес — только если выбрана доставка.
- Комментарий к заказу — если вы его написали.

## Что мы с этим делаем
Используем, чтобы обработать заказ: позвонить, подтвердить наличие, согласовать доставку и оплату. Телефон в админке показан не полностью: сотрудник открывает его только когда это нужно для заказа, и это действие записывается в журнал.

## Чего мы не делаем
- Не продаём и не передаём данные третьим лицам для рекламы.
- Не принимаем на сайте оплату, поэтому данных карт у нас нет и быть не может.
- Не собираем VIN и госномера: такого поиска на сайте нет.

## Что хранится в вашем браузере
Корзина, избранное и просмотренные детали хранятся в самом браузере, а не у нас. Очистка данных сайта в браузере их удаляет.

## Как удалить свои данные
Позвоните оператору с 8:00 до 20:00 и попросите удалить заказ и контакты. Удаляем, если по заказу нет незакрытых обязательств.

_Текст политики проверяет юрист. Окончательные формулировки могут быть уточнены._`,
    bodyRo: `Colectăm exact atâtea date cât este nevoie ca să vă aducem piesa.

## Ce cerem
- Numele și telefonul — ca operatorul să vă sune și să confirme comanda.
- Adresa — doar dacă ați ales livrarea.
- Comentariul la comandă — dacă l-ați scris.

## Ce facem cu ele
Le folosim pentru a procesa comanda: să sunăm, să confirmăm stocul, să convenim livrarea și plata. În panoul de administrare telefonul este afișat parțial: angajatul îl deschide doar când este necesar, iar acțiunea se înscrie în jurnal.

## Ce nu facem
- Nu vindem și nu transmitem date terților pentru publicitate.
- Nu încasăm plăți pe site, deci date de card nu avem și nu putem avea.
- Nu colectăm VIN și numere de înmatriculare: această căutare nu există pe site.

## Ce se păstrează în browserul dumneavoastră
Coșul, favoritele și piesele vizualizate se păstrează în browser, nu la noi. Ștergerea datelor site-ului din browser le elimină.

## Cum vă ștergeți datele
Sunați operatorul între 8:00 și 20:00 și cereți ștergerea comenzii și a contactelor. Ștergem dacă pe comandă nu există obligații neîncheiate.

_Textul politicii este verificat de jurist. Formulările finale pot fi precizate._`,
  },
  {
    slug: "vacancies",
    titleRu: "Вакансии",
    titleRo: "Locuri de muncă",
    image: "/images/team/parts-expert.png",
    seoTitle: "Работа в NAA.md — Слободзея",
    seoDescription: "Кого мы ищем на разборку в Слободзее и как с нами связаться.",
    inHeader: true,
    showContacts: true,
    placement: "footer-company",
    bodyRu: `Нам нужны руки и люди, которые разбираются в машинах. Резюме не обязательно — позвоните и расскажите, что умеете.

## Кого ищем
- Разборщик: снимать детали с машин, аккуратно и без лишних поломок.
- Подборщик деталей: знать, что подойдёт на какую машину, и уметь объяснить это покупателю.
- Помощник на склад: принять, разметить, положить на место, выдать.

## Что от нас
Работа в Слободзее, на одной площадке. Зарплату и график обсуждаем лично — зависит от опыта и от того, что вы умеете.

## Как откликнуться
Позвоните с 8:00 до 20:00 или напишите в Viber или Telegram. Скажите, на какую работу и какой у вас опыт.`,
    bodyRo: `Avem nevoie de oameni care se descurcă cu mașinile. CV-ul nu este obligatoriu — sunați și spuneți ce știți să faceți.

## Pe cine căutăm
- Dezmembrator: să demonteze piese de pe mașini, cu grijă.
- Consultant de piese: să știe ce se potrivește pe fiecare mașină și să poată explica cumpărătorului.
- Ajutor la depozit: să primească, să marcheze, să aranjeze și să predea.

## Ce oferim
Lucru în Slobozia, pe o singură platformă. Salariul și programul le discutăm personal — depind de experiență.

## Cum aplicați
Sunați între 8:00 și 20:00 sau scrieți pe Viber sau Telegram. Spuneți pentru ce post și ce experiență aveți.`,
  },
  {
    slug: "media",
    titleRu: "Новости",
    titleRo: "Noutăți",
    image: "/images/posts/oil-change.png",
    seoTitle: "Новости NAA.md",
    seoDescription: "Что нового на разборке: поступления машин-доноров, изменения в работе, полезные заметки.",
    inHeader: false,
    showContacts: false,
    placement: "footer-company",
    bodyRu: `Короткие заметки о том, что происходит на складе. Страницу ведёт владелец вручную.

## О чём пишем
- Пришла новая машина-донор: марка, модель, год — значит, появятся детали с неё.
- Изменились часы работы или условия доставки.
- Полезное из практики: на что смотреть при покупке б/у детали, что меняют заодно.

Пока записей нет — здесь появится первая, как только владелец её добавит.`,
    bodyRo: `Note scurte despre ce se întâmplă la depozit. Pagina este ținută manual de proprietar.

## Despre ce scriem
- A venit un automobil donator nou: marca, modelul, anul — deci vor apărea piese de pe el.
- S-au schimbat orele de lucru sau condițiile de livrare.
- Lucruri utile din practică: la ce să vă uitați când cumpărați o piesă folosită.

Deocamdată nu există înregistrări — prima va apărea când proprietarul o va adăuga.`,
  },
  {
    slug: "reviews",
    titleRu: "Отзывы клиентов",
    titleRo: "Recenziile clienților",
    image: "",
    seoTitle: "Отзывы о NAA.md",
    seoDescription: "Что говорят покупатели разборки в Слободзее и как оставить отзыв.",
    inHeader: false,
    showContacts: true,
    placement: "footer-company",
    bodyRu: `Отзывы на этой странице добавляет владелец вручную, из звонков и сообщений. Выдуманных отзывов здесь нет — если страница пустая, значит, настоящих ещё не добавили.

## Как оставить отзыв
Позвоните оператору с 8:00 до 20:00 или напишите в Viber или Telegram. Скажите номер заказа и что хотите добавить — и хорошее, и плохое.

## Что нам полезнее всего услышать
- Подошла ли деталь и как прошла установка.
- Совпало ли состояние с тем, что назвал оператор.
- Сколько ждали доставку.`,
    bodyRo: `Recenziile de pe această pagină sunt adăugate manual de proprietar, din apeluri și mesaje. Recenzii inventate aici nu există — dacă pagina este goală, înseamnă că încă nu au fost adăugate recenzii reale.

## Cum lăsați o recenzie
Sunați operatorul între 8:00 și 20:00 sau scrieți pe Viber sau Telegram. Spuneți numărul comenzii și ce vreți să adăugați — și bun, și rău.

## Ce ne este cel mai util să auzim
- Dacă piesa s-a potrivit și cum a mers montajul.
- Dacă starea a corespuns cu ce a spus operatorul.
- Cât ați așteptat livrarea.`,
  },
];
