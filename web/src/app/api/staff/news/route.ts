import {currentStaff,sameOrigin} from '@/lib/staff-auth';
import {articles,saveArticle} from '@/lib/news';
export const runtime='nodejs';
export async function GET(){const actor=await currentStaff();if(actor?.role!=='owner')return new Response(null,{status:403});return Response.json({articles:await articles(true)},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){if(!sameOrigin(request))return new Response(null,{status:403});const actor=await currentStaff();if(actor?.role!=='owner')return new Response(null,{status:403});try{await saveArticle(actor,await request.json());return Response.json({ok:true});}catch(e){return Response.json({message:e instanceof Error?e.message:'Ошибка сохранения.'},{status:400});}}
