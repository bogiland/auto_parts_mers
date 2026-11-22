import {currentStaff,sameOrigin} from '@/lib/staff-auth';
import {many} from '@/lib/db';
import {moderateReview} from '@/lib/reviews';
export const runtime='nodejs';
export async function GET(){if(!await currentStaff())return new Response(null,{status:401});return Response.json({reviews:await many('SELECT * FROM product_reviews ORDER BY created_at DESC LIMIT 300')},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){if(!sameOrigin(request))return new Response(null,{status:403});const actor=await currentStaff();if(!actor)return new Response(null,{status:401});try{await moderateReview(actor,await request.json());return Response.json({ok:true});}catch(e){return Response.json({message:e instanceof Error?e.message:'Ошибка.'},{status:400});}}
