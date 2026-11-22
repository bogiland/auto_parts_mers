import Link from 'next/link';
import {notFound} from 'next/navigation';
import {SiteHeader} from '@/components/header/SiteHeader';
import {SiteFooter} from '@/components/layout/site-footer';
import {ReviewsBlock} from '@/components/reviews/ReviewsBlock';
import {getLiveHomepage} from '@/lib/live-catalog';
import {findPage} from '@/lib/pages-db';
export const dynamic='force-dynamic';
export default async function Page(){if(!await findPage('reviews'))notFound();const home=await getLiveHomepage({ includeInventory: false });return <><SiteHeader hours={home.hours} phone={home.phone}/><main className="container-site py-8"><p className="text-meta text-ink-2"><Link href="/">Главная</Link> / Отзывы</p><div className="mt-6"><ReviewsBlock/></div></main><SiteFooter/></>}
