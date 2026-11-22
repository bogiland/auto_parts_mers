import {activeBanner} from '@/lib/advertising';
import {sameOrigin} from '@/lib/staff-auth';
import {run} from '@/lib/db';
import {currentStaff} from '@/lib/staff-auth';
import {one} from '@/lib/db';
export const runtime='nodejs';
export async function GET(request:Request){const query=new URL(request.url).searchParams,slot=query.get('slot')??'',preview=Number(query.get('preview'));if(preview){const actor=await currentStaff();if(actor?.role!=='owner')return new Response(null,{status:403});const banner=await one<{id:number;image:string;advertiser:string}>('SELECT id,image,advertiser FROM ad_banners WHERE id=$1 AND placement=$2',[preview,slot]);return Response.json({banner:banner?{...banner,preview:true}:null},{headers:{'Cache-Control':'no-store'}});}const banner=await activeBanner(slot);return Response.json({banner:banner?{id:banner.id,image:banner.image,advertiser:banner.advertiser}:null},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){if(!sameOrigin(request))return new Response(null,{status:403});try{const data=await request.json(),id=Number(data.id);if(!Number.isSafeInteger(id)||id<1)return new Response(null,{status:400});await run("INSERT INTO ad_events(banner_id,kind) SELECT id,'view' FROM ad_banners WHERE id=$1 AND enabled AND start_at<=now() AND end_at>now()",[id]);return new Response(null,{status:204});}catch{return new Response(null,{status:400});}}
