import { bodyFailure, bodyLimits, humanOrFallback, readJson } from "@/lib/http";
import {currentStaff,sameOrigin} from '@/lib/staff-auth';
import {articles,saveArticle} from '@/lib/news';
export const runtime='nodejs';
export async function GET(){const actor=await currentStaff();if(actor?.role!=='owner')return new Response(null,{status:403});return Response.json({articles:await articles(true)},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){if(!sameOrigin(request))return new Response(null,{status:403});const actor=await currentStaff();if(actor?.role!=='owner')return new Response(null,{status:403});try{await saveArticle(actor,await readJson(request, bodyLimits.gallery));return Response.json({ok:true});}catch(e){const failed=bodyFailure(e);if(failed)return failed;return Response.json({message:humanOrFallback(e,'Ошибка сохранения.')},{status:400});}}
