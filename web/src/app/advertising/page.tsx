import Link from 'next/link';
import {SiteHeader} from '@/components/header/SiteHeader';
import {SiteFooter} from '@/components/layout/site-footer';
import {AdRequestForm} from '@/components/ads/AdRequestForm';
import {getLiveHomepage} from '@/lib/live-catalog';
import {slots,slotPrices} from '@/lib/advertising';
export const dynamic='force-dynamic';
export default async function Page(){const home=await getLiveHomepage({ includeInventory: false }),prices=await slotPrices();return <><SiteHeader hours={home.hours} phone={home.phone}/><main className="container-site py-8"><p className="text-meta text-ink-2"><Link href="/">Главная</Link> / Реклама</p><h1 className="text-section font-bold mt-4">Реклама на NAA.md</h1><p className="text-body mt-4">Посетители сайта ищут запчасти и услуги для автомобилей в ПМР и Молдове. Количество посетителей и стоимость размещения уточнит оператор.</p><div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6"><section className="min-w-0"><h2 className="text-block font-bold">Места для баннеров</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">{slots.map(s=><article className="rounded-ui border border-line p-4" key={s.id}><div className="aspect-[1064/160] rounded-ui bg-surface-2"/><h3 className="text-body font-bold mt-2">{s.label}</h3><p className="text-meta text-ink-2 mt-2">{s.size} ? {prices[s.id]===null||prices[s.id]===undefined?"Цена уточняется":`${prices[s.id]} руб.`}</p></article>)}</div></section><AdRequestForm/></div></main><SiteFooter/></>}
