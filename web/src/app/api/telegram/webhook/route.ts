import { acceptUpdate } from '@/lib/telegram';
import { matchesSecret } from '@/lib/operations-auth';
export const runtime='nodejs';
export async function POST(request:Request){if(!matchesSecret(request.headers.get('x-telegram-bot-api-secret-token'),process.env.TELEGRAM_WEBHOOK_SECRET))return new Response(null,{status:403});try{await acceptUpdate(await request.json());return Response.json({ok:true});}catch{return new Response(null,{status:400});}}
