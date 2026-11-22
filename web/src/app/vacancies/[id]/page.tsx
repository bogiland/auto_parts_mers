import Link from 'next/link';
import Image from 'next/image';
import {notFound} from 'next/navigation';
import {SiteHeader} from '@/components/header/SiteHeader';
import {SiteFooter} from '@/components/layout/site-footer';
import {ApplicationForm} from '@/components/vacancies/ApplicationForm';
import {vacancy} from '@/lib/vacancies';
import {findPage} from '@/lib/pages-db';
import {getLiveHomepage} from '@/lib/live-catalog';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const job=await vacancy(Number(id));if(!job||!await findPage('vacancies'))notFound();const home=await getLiveHomepage({ includeInventory: false });return <><SiteHeader hours={home.hours} phone={home.phone}/><main className="container-site py-8"><p className="text-meta text-ink-2"><Link href="/">Главная</Link> / <Link href="/vacancies">Вакансии</Link> / {job.title}</p><h1 className="text-section font-bold mt-4">{job.title}</h1><p className="text-body mt-4">{job.schedule} · {job.location}</p><div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-6"><div className="min-w-0">{job.image&&<div className="relative aspect-[16/9] overflow-hidden rounded-ui"><Image src={job.image} alt="" fill sizes="(min-width: 1200px) 50vw, 100vw" className="object-cover"/></div>}<p className="text-body whitespace-pre-wrap mt-4">{job.description}</p></div><ApplicationForm vacancyId={job.id}/></div></main><SiteFooter/></>}
