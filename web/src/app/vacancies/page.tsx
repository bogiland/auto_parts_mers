import Link from 'next/link';
import Image from 'next/image';
import {SiteHeader} from '@/components/header/SiteHeader';
import {SiteFooter} from '@/components/layout/site-footer';
import {ApplicationForm} from '@/components/vacancies/ApplicationForm';
import {vacancies} from '@/lib/vacancies';
import {findPage} from '@/lib/pages-db';
import {getLiveHomepage} from '@/lib/live-catalog';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page(){if(!await findPage('vacancies'))notFound();const jobs=await vacancies(),home=await getLiveHomepage({ includeInventory: false });return <><SiteHeader hours={home.hours} phone={home.phone}/><main className="container-site py-8"><p className="text-meta text-ink-2"><Link href="/">Главная</Link> / Вакансии</p><h1 className="text-section font-bold mt-4">Работа в NAA.md</h1><p className="text-body mt-4">Присоединяйтесь к команде авторазборки в Слободзее. Расскажем об условиях и ответим на вопросы.</p>{jobs.length?<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">{jobs.map(job=><article key={job.id} className="min-w-0 rounded-ui border border-line p-4">{job.image&&<div className="relative aspect-[16/9] overflow-hidden rounded-ui"><Image src={job.image} alt="" fill sizes="(min-width: 1200px) 33vw, 100vw" className="object-cover"/></div>}<h2 className="text-block font-bold mt-4">{job.title}</h2><p className="text-meta text-ink-2 mt-2">{job.schedule} · {job.location}</p><p className="text-body mt-4 line-clamp-2">{job.description}</p><Link className="mt-4 inline-flex min-h-11 items-center text-body text-accent" href={`/vacancies/${job.id}`}>Подробнее →</Link></article>)}</div>:<div className="mt-6"><p className="text-body mb-4">Сейчас вакансий нет, оставьте контакты.</p><ApplicationForm/></div>}</main><SiteFooter/></>}
