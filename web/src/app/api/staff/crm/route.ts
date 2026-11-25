import { bodyFailure, bodyLimits, humanOrFallback, readJson } from "@/lib/http";
import { currentStaff, sameOrigin } from "@/lib/staff-auth";
import { addTask, call, cases, clientDetail, clients, completeTask, crmReport, mergeClients, offer, saveClient, stage, tasks, waitForPart } from "@/lib/crm";
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){const actor=await currentStaff();if(!actor)return new Response(null,{status:401});const url=new URL(request.url);try{
 if(url.searchParams.has('client'))return Response.json(await clientDetail(Number(url.searchParams.get('client'))));
 return Response.json({clients:await clients(url.searchParams.get('q')??''),cases:await cases(),tasks:await tasks(),report:actor.role==='owner'?await crmReport():null,actor});
}catch(e){const failed=bodyFailure(e);if(failed)return failed;return Response.json({message:humanOrFallback(e,'Ошибка')},{status:400});}}
export async function POST(request:Request){if(!sameOrigin(request))return new Response(null,{status:403});const actor=await currentStaff();if(!actor)return new Response(null,{status:401});try{
 const b=await readJson(request, bodyLimits.gallery);if(!b||typeof b!=='object')throw new Error('Некорректный запрос.');
 switch(b.action){case 'call':return Response.json({id:await call(actor,b)});case 'stage':await stage(actor,b);break;case 'client':await saveClient(actor,b);break;
 case 'merge':await mergeClients(actor,Number(b.from),Number(b.to));break;case 'task':await addTask(actor,b);break;case 'done':await completeTask(actor,Number(b.id));break;
 case 'offer':return Response.json({text:await offer(actor,Number(b.caseId),Array.isArray(b.ids)?b.ids.map(String):[])});case 'wait':await waitForPart(actor,b);break;default:throw new Error('Неизвестное действие.');}
 return Response.json({ok:true});
}catch(e){const failed=bodyFailure(e);if(failed)return failed;return Response.json({message:humanOrFallback(e,'Ошибка')},{status:400});}}
