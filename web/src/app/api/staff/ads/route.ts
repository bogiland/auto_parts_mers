import { bodyFailure, bodyLimits, humanOrFallback, readJson } from "@/lib/http";
import {currentStaff,sameOrigin} from '@/lib/staff-auth';
import {banners,saveBanner,slotPrices,slots} from '@/lib/advertising';
import {run} from '@/lib/db';
import {audit} from '@/lib/staff-db';
import {articles} from '@/lib/news';
import {publicParts} from '@/lib/parts-db';
export const runtime='nodejs';
export async function GET(){const actor=await currentStaff();if(actor?.role!=='owner')return new Response(null,{status:403});const [items,news,parts,prices]=await Promise.all([banners(),articles(),publicParts(),slotPrices()]);return Response.json({banners:items,prices,previewPaths:{home:'/',catalog:'/catalog/legkovye/all',footer:'/',article:news[0]?`/news/${news[0].slug}`:null,product:parts[0]?`/products/${parts[0].id}`:null}},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){if(!sameOrigin(request))return new Response(null,{status:403});const actor=await currentStaff();if(actor?.role!=='owner')return new Response(null,{status:403});try{const data=await readJson(request, bodyLimits.gallery);if(data.action==='slot-price'){const placement=String(data.placement??''),price=data.price===''?null:Number(data.price);if(!slots.some(s=>s.id===placement)||(price!==null&&(!Number.isSafeInteger(price)||price<0)))throw new Error('Проверьте место и стоимость.');await run('INSERT INTO ad_slot_settings(placement,price_mdl) VALUES($1,$2) ON CONFLICT(placement) DO UPDATE SET price_mdl=EXCLUDED.price_mdl',[placement,price]);await audit(actor,'Ad placement price',placement);}else await saveBanner(actor,data);return Response.json({ok:true});}catch(e){const failed=bodyFailure(e);if(failed)return failed;return Response.json({message:humanOrFallback(e,'Ошибка сохранения.')},{status:400});}}
