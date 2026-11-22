import "server-only";
import { many, one, run, transaction } from "@/lib/db";
import { audit, toInternational, type Staff } from "@/lib/staff-db";
import { getSettings } from "@/lib/checkout-db";
import { clientDiscount, discountedPrice } from "@/lib/client-pricing";

export const stages = [{id:"new",label:"Новое"},{id:"working",label:"В работе"},{id:"offered",label:"Предложение отправлено"},{id:"waiting",label:"Ждём клиента"},{id:"issued",label:"Выдано"},{id:"refused",label:"Отказ"}];
export const refusals = ["нет на складе","дорого","купил в другом месте","не отвечает","не подошло"];
export type CrmClient = { id:number; phone:string; name:string; email:string; telegram_username:string; kind:string; discount:number; tags:string; notes:string; vehicles:string; purchases:number; orders:number };
export type CrmCase = { id:number; client_id:number; name:string; phone:string; need:string; source:string; stage:string; refusal:string; owner_id:number|null; order_id:number|null; inquiry_id:number|null; updated_at:string; version:number; next_task:string|null; due_at:string|null };
export type CrmTask = {id:number;case_id:number;owner_id:number;title:string;due_at:string;done:boolean;name:string;need:string};
export type CrmEvent = {id:number;actor:string;title:string;detail:string;at:string};
const string = (v:unknown,max=1000) => typeof v==='string'?v.trim().slice(0,max):'';
const idOf=(v:unknown)=>{const id=Number(v);if(!Number.isSafeInteger(id)||id<1)throw new Error('Неверный номер записи.');return id;};
export async function clients(query='',id:number|null=null):Promise<CrmClient[]> {
 return many<CrmClient>(`SELECT c.*,COALESCE(s.purchases,0)::integer purchases,COALESCE(s.orders,0)::integer orders FROM crm_clients c LEFT JOIN
 (SELECT COALESCE(a.client_id,k.id) client_id,SUM(o.total_mdl+o.delivery_cost_mdl) FILTER(WHERE o.status='issued') purchases,COUNT(*) orders FROM orders o LEFT JOIN crm_phone_aliases a ON a.phone=crm_phone(o.phone) LEFT JOIN crm_clients k ON k.phone=crm_phone(o.phone) GROUP BY COALESCE(a.client_id,k.id)) s ON s.client_id=c.id
 WHERE ($2::integer IS NULL OR c.id=$2) AND (c.name ILIKE $1 OR c.phone LIKE $1 OR c.tags ILIKE $1) ORDER BY c.id DESC LIMIT 300`,[`%${query}%`,id]);
}
export async function cases():Promise<CrmCase[]> {return many<CrmCase>(`SELECT k.*,c.name,c.phone,t.title next_task,t.due_at FROM crm_cases k JOIN crm_clients c ON c.id=k.client_id
 LEFT JOIN LATERAL(SELECT title,due_at FROM crm_tasks WHERE case_id=k.id AND NOT done ORDER BY due_at LIMIT 1)t ON true ORDER BY k.updated_at DESC LIMIT 400`);}
export async function tasks():Promise<CrmTask[]> {return many<CrmTask>(`SELECT t.*,c.name,k.need FROM crm_tasks t JOIN crm_cases k ON k.id=t.case_id JOIN crm_clients c ON c.id=k.client_id WHERE NOT t.done ORDER BY t.due_at LIMIT 400`);}
export async function clientDetail(id:number) {
 const client=(await clients('',id))[0];if(!client)throw new Error('Клиент не найден.');
 return {client,cases:(await cases()).filter(k=>k.client_id===id),events:await many<CrmEvent>('SELECT * FROM crm_events WHERE client_id=$1 ORDER BY at DESC,id DESC LIMIT 200',[id]),orders:await many('SELECT id,status,total_mdl,delivery_cost_mdl,created_at FROM orders WHERE crm_phone(phone)=$1 OR crm_phone(phone) IN(SELECT phone FROM crm_phone_aliases WHERE client_id=$2) ORDER BY id DESC',[client.phone,id])};
}
async function event(actor:Staff,caseId:number,title:string,detail='') {
 await run('INSERT INTO crm_events(client_id,case_id,actor,title,detail) SELECT client_id,id,$2,$3,$4 FROM crm_cases WHERE id=$1',[caseId,actor.name,title,detail]);
 await audit(actor,title,`Обращение № ${caseId}: ${detail}`);
}
export async function call(actor:Staff,input:Record<string,unknown>) {return transaction(async()=>{
 const phone=toInternational(string(input.phone,40));if(!/^\+\d{8,15}$/.test(phone))throw new Error('Проверьте телефон.');
 const need=string(input.need);if(need.length<2)throw new Error('Напишите, что нужно клиенту.');
 const source=string(input.source,40)||'call';if(!['call','site','expert','catalog','viber','telegram','whatsapp','other'].includes(source))throw new Error('Выберите источник.');
 const alias=await one<{id:number}>('SELECT client_id id FROM crm_phone_aliases WHERE phone=$1',[phone]);
 const client=alias??await one<{id:number}>('INSERT INTO crm_clients(phone,name) VALUES($1,$2) ON CONFLICT(phone) DO UPDATE SET name=CASE WHEN crm_clients.name=\'\' THEN EXCLUDED.name ELSE crm_clients.name END RETURNING id',[phone,string(input.name,100)]);
 const created=await one<{id:number}>('INSERT INTO crm_cases(client_id,need,source,owner_id) VALUES($1,$2,$3,$4) RETURNING id',[client!.id,need,source,actor.id]);
 await event(actor,created!.id,'Новое обращение',need);return created!.id;
});}
export async function stage(actor:Staff,input:Record<string,unknown>){return transaction(async()=>{
 const id=idOf(input.id), row=await one<{version:number}>('SELECT version FROM crm_cases WHERE id=$1 FOR UPDATE',[id]);
 if(!row)throw new Error('Обращение не найдено.');if(Number(input.version)!==row.version)throw new Error('Обращение изменил другой человек, обновите страницу.');
 const stage=string(input.stage,20),reason=string(input.refusal,100);if(!stages.some(s=>s.id===stage))throw new Error('Неизвестный этап.');
 if(stage==='refused'&&!refusals.includes(reason))throw new Error('Выберите причину отказа.');
 await run('UPDATE crm_cases SET stage=$2,refusal=$3,updated_at=now(),version=version+1 WHERE id=$1',[id,stage,stage==='refused'?reason:'']);await event(actor,id,'Этап обращения',`${stages.find(s=>s.id===stage)?.label} ${reason}`);
});}
export async function saveClient(actor:Staff,input:Record<string,unknown>){return transaction(async()=>{
 const id=idOf(input.id),kind=string(input.kind,20),discount=Number(input.discount??0);if(!['private','sto','reseller'].includes(kind)||!Number.isInteger(discount)||discount<0||discount>100)throw new Error('Проверьте тип и скидку.');
 const previous=await one<{discount:number}>('SELECT discount FROM crm_clients WHERE id=$1 FOR UPDATE',[id]);
 if(discount!==(previous?.discount??0)&&actor.role!=='owner')throw new Error('Персональную скидку назначает владелец.');
 const telegram=typeof input.telegram_username==='string'?string(input.telegram_username,33).replace(/^@/,''):null;if(telegram&&!/^[a-zA-Z0-9_]{5,32}$/.test(telegram))throw new Error('Проверьте имя пользователя Telegram.');
 const changed=await run('UPDATE crm_clients SET name=$2,email=$3,kind=$4,discount=$5,tags=$6,notes=$7,vehicles=$8,telegram_username=COALESCE($9,telegram_username) WHERE id=$1',[id,string(input.name,100),string(input.email,120),kind,kind==='sto'?discount:0,string(input.tags,300),string(input.notes,3000),string(input.vehicles,2000),telegram]);if(!changed)throw new Error('Клиент не найден.');
 await run('INSERT INTO crm_events(client_id,actor,title) VALUES($1,$2,\'Карточка клиента обновлена\')',[id,actor.name]);await audit(actor,'Карточка клиента',String(id));
});}
export async function mergeClients(actor:Staff,from:number,to:number){return transaction(async()=>{
 if(actor.role!=='owner')throw new Error('Объединение доступно владельцу.');if(from===to)throw new Error('Выберите другого клиента.');
 const rows=await many<CrmClient>('SELECT * FROM crm_clients WHERE id=ANY($1::integer[]) ORDER BY id FOR UPDATE',[[from,to]]);if(rows.length!==2)throw new Error('Клиент не найден.');
 const original=rows.find(c=>c.id===from)!,target=rows.find(c=>c.id===to)!;
 await run('UPDATE crm_cases SET client_id=$2 WHERE client_id=$1',[from,to]);await run('UPDATE crm_events SET client_id=$2 WHERE client_id=$1',[from,to]);
 await run('UPDATE crm_clients SET notes=$2,vehicles=$3,tags=$4,telegram_username=$5 WHERE id=$1',[to,[target.notes,original.notes,`Дополнительный телефон: ${original.phone}`,target.telegram_username&&original.telegram_username&&target.telegram_username!==original.telegram_username?`Дополнительный Telegram: @${original.telegram_username}`:''].filter(Boolean).join('\n'),[target.vehicles,original.vehicles].filter(Boolean).join('\n'),[target.tags,original.tags].filter(Boolean).join(', '),target.telegram_username||original.telegram_username]);
 await run('INSERT INTO crm_phone_aliases(phone,client_id) VALUES($1,$2) ON CONFLICT(phone) DO UPDATE SET client_id=EXCLUDED.client_id',[original.phone,to]);
 await run('UPDATE crm_phone_aliases SET client_id=$2 WHERE client_id=$1',[from,to]);await run('DELETE FROM crm_clients WHERE id=$1',[from]);await audit(actor,'Клиенты объединены',`${from} → ${to}`);
});}
export async function addTask(actor:Staff,input:Record<string,unknown>){return transaction(async()=>{
 const caseId=idOf(input.caseId),title=string(input.title,200),date=new Date(String(input.dueAt));if(title.length<2||!Number.isFinite(date.getTime()))throw new Error('Укажите задачу и время.');
 const ownerId=input.ownerId?idOf(input.ownerId):actor.id;if(ownerId!==actor.id&&actor.role!=='owner')throw new Error('Можно назначить задачу только себе.');
 if(!await one('SELECT id FROM crm_cases WHERE id=$1',[caseId]))throw new Error('Обращение не найдено.');
 await run('INSERT INTO crm_tasks(case_id,owner_id,title,due_at) VALUES($1,$2,$3,$4)',[caseId,ownerId,title,date.toISOString()]);await event(actor,caseId,'Задача',`${title}: ${date.toISOString()}`);
});}
export async function completeTask(actor:Staff,id:number){return transaction(async()=>{
 const task=await one<CrmTask>('SELECT * FROM crm_tasks WHERE id=$1 FOR UPDATE',[id]);if(!task)throw new Error('Задача не найдена.');if(task.owner_id!==actor.id&&actor.role!=='owner')throw new Error('Это задача другого сотрудника.');
 if(!task.done){await run('UPDATE crm_tasks SET done=true WHERE id=$1',[id]);await event(actor,task.case_id,'Задача выполнена',task.title);}
});}
export async function offer(actor:Staff,caseId:number,ids:string[]) {return transaction(async()=>{
 if(!ids.length||ids.length>30)throw new Error('Выберите от 1 до 30 деталей.');
 const items=await many<{id:string;name:string;price_mdl:number|null;stock:number}>('SELECT id,name,price_mdl,stock FROM catalog_products WHERE id=ANY($1::text[]) AND hidden=0',[ids]);if(items.length!==new Set(ids).size)throw new Error('Одна из деталей недоступна.');
 const customer=await one<{phone:string}>('SELECT c.phone FROM crm_cases k JOIN crm_clients c ON c.id=k.client_id WHERE k.id=$1',[caseId]);if(!customer)throw new Error('Обращение не найдено.');
 const discount=await clientDiscount(customer.phone);for(const item of items)if(item.price_mdl!==null)item.price_mdl=discountedPrice(item.price_mdl,discount);
 const settings=await getSettings(),origin=(process.env.NEXT_PUBLIC_SITE_URL??'http://localhost:3000').replace(/\/$/,'');
 const text='NAA.md — предложение:\n'+items.map(p=>`${p.name}: ${p.price_mdl===null?'по запросу':`${p.price_mdl} MDL${settings.rubPerMdl?` / ${Math.round(p.price_mdl*settings.rubPerMdl)} руб. ПМР`:''}`} · остаток ${p.stock}\n${origin}/products/${p.id}`).join('\n\n');
 const updated=await run("UPDATE crm_cases SET stage='offered',version=version+1,updated_at=now() WHERE id=$1",[caseId]);if(!updated)throw new Error('Обращение не найдено.');await event(actor,caseId,'Предложение подготовлено',text);return text;
});}
export async function waitForPart(actor:Staff,input:Record<string,unknown>){const query=string(input.query,200);if(query.length<2)throw new Error('Укажите название ожидаемой детали.');const caseId=idOf(input.caseId);await run('INSERT INTO crm_waits(case_id,query,category_id,donor_id) VALUES($1,$2,$3,$4)',[caseId,query,string(input.categoryId,100)||null,string(input.donorId,100)||null]);await event(actor,caseId,'Ожидание поступления',query);}
export async function crmReport(){return {sources:await many("SELECT source,COUNT(*)::integer total,COUNT(*) FILTER(WHERE stage='issued')::integer issued FROM crm_cases GROUP BY source ORDER BY total DESC"),refusals:await many("SELECT refusal,COUNT(*)::integer total FROM crm_cases WHERE stage='refused' GROUP BY refusal"),clients:await one("SELECT COUNT(*)::integer total,COUNT(*) FILTER(WHERE kind='sto')::integer sto FROM crm_clients"),repeat:await one('SELECT COUNT(*)::integer total FROM(SELECT crm_phone(phone) FROM orders WHERE status=\'issued\' GROUP BY crm_phone(phone) HAVING COUNT(*)>1)s')};}
