import { telegramTick } from '@/lib/telegram';
import { matchesSecret } from '@/lib/operations-auth';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){if(!matchesSecret(request.headers.get('authorization'),process.env.OPERATIONS_SECRET?`Bearer ${process.env.OPERATIONS_SECRET}`:undefined))return new Response(null,{status:403});return Response.json(await telegramTick());}
