import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {randomBytes} from 'node:crypto';

const schema='naa_test_'+randomBytes(5).toString('hex');
let admin:pg.Client;
let db:typeof import('./db');
let crm:typeof import('./crm');
let bot:typeof import('./telegram');
let orders:typeof import('./orders-db');
let actor:{id:number;name:string;phone:string;role:'owner'};
const product='qa-lamp';let caseId:number,orderId:number;
let savedBotToken:string|undefined;
beforeAll(async()=>{
 // В начале .env.local стоит BOM: без его отбрасывания первая строка (DATABASE_URL) не разбиралась,
 // и весь набор падал на входе в базу с невнятной ошибкой SASL.
 for(const line of readFileSync('.env.local','utf8').replace(/^﻿/,'').split(/\r?\n/)){const m=/^([A-Z_]+)=(.*)$/.exec(line.trim());if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
 savedBotToken=process.env.TELEGRAM_BOT_TOKEN;delete process.env.TELEGRAM_BOT_TOKEN;
 const base=process.env.DATABASE_URL!;admin=new pg.Client({connectionString:base});await admin.connect();await admin.query(`CREATE SCHEMA ${schema}`);
 const url=new URL(base);url.searchParams.set('options',`-c search_path=${schema}`);process.env.DATABASE_URL=url.toString();
 db=await import('./db');await db.pool().query(readFileSync('db/schema.sql','utf8'));await db.pool().query(readFileSync('db/operations.sql','utf8'));
 crm=await import('./crm');bot=await import('./telegram');orders=await import('./orders-db');
 const row=await db.one<{id:number}>("INSERT INTO staff_users(name,phone,role) VALUES('QA Owner','+37377700001','owner') RETURNING id");actor={id:row!.id,name:'QA Owner',phone:'+37377700001',role:'owner'};
 await db.run("INSERT INTO catalog_products(id,name,sku,price_mdl,stock,price_mode,location) VALUES($1,'Фара тестовая','QA-001',500,1,'fixed','А-1')",[product]);
},30000);
afterAll(async()=>{vi.restoreAllMocks();if(savedBotToken)process.env.TELEGRAM_BOT_TOKEN=savedBotToken;else delete process.env.TELEGRAM_BOT_TOKEN;if(db)await db.pool().end();if(admin){await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();}},30000);
describe.sequential('CRM and Telegram on PostgreSQL',()=>{
 it('public stock includes products beyond the former 500-row limit',async()=>{
  await db.run("INSERT INTO catalog_products(id,name,sku,stock,price_mode,created_at) SELECT 'qa-bulk-'||n, 'QA bulk', 'QA-BULK-'||n, 1, 'on_request', '2020-01-01' FROM generate_series(1,501) n");
  const {publicParts}=await import('./parts-db');
  expect((await publicParts()).filter(p=>p.id.startsWith('qa-bulk-'))).toHaveLength(501);
  await db.run("DELETE FROM catalog_products WHERE id LIKE 'qa-bulk-%'");
  await db.run("DELETE FROM operations_events WHERE kind='stock' AND entity_id LIKE 'qa-bulk-%'");
 });
 it('shows only active home banners and hides them after expiry',async()=>{
  const ads=await import('./advertising');
  const result=await db.one<{id:number}>("INSERT INTO ad_banners(advertiser,phone,image,url,placement,start_at,end_at,enabled,report_token) VALUES('QA','+37377700000','/test.png','https://example.com','home',now()-interval '1 day',now()+interval '1 day',true,$1) RETURNING id",['qa-home-'+randomBytes(20).toString('hex')]);
  expect((await ads.activeBanner('home'))?.id).toBe(result?.id);
  await db.run("UPDATE ad_banners SET end_at=now()-interval '1 second' WHERE id=$1",[result!.id]);
  expect(await ads.activeBanner('home')).toBeNull();
 });
 it('call → offer → order is one client and one timeline',async()=>{
  caseId=await crm.call(actor,{phone:'077700002',name:'QA Client',need:'Фара',source:'call'});
  const list=await crm.cases();expect(list.find(k=>k.id===caseId)?.phone).toBe('+37377700002');
  const text=await crm.offer(actor,caseId,[product]);expect(text).toContain('500 руб.');expect(text).toContain(`/products/${product}`);
  const result=await orders.createCallOrder(actor,{phone:'77700002',name:'QA Client',items:[{id:product,quantity:1}]});orderId=result.id;
  const detail=await crm.clientDetail((await crm.cases()).find(k=>k.id===caseId)!.client_id);expect(detail.cases).toHaveLength(1);expect(detail.orders).toHaveLength(1);expect(detail.events.some(e=>e.title==='Предложение подготовлено')).toBe(true);
 });
 it('private one-time linking rejects groups and token reuse',async()=>{
  process.env.TELEGRAM_BOT_USERNAME='naa_test_bot';const link=await bot.connectTelegram(actor),token=new URL(link).searchParams.get('start');
  await bot.acceptUpdate({update_id:1,message:{text:`/start ${token}`,chat:{id:101,type:'group'},from:{id:101}}});await bot.telegramTick();expect(await db.one('SELECT * FROM telegram_links')).toBeNull();
  await bot.acceptUpdate({update_id:2,message:{text:`/start ${token}`,chat:{id:101,type:'private'},from:{id:101}}});await bot.telegramTick();expect((await db.one<{staff_id:number}>('SELECT * FROM telegram_links'))?.staff_id).toBe(actor.id);
  expect((await db.one<{text:string}>("SELECT payload->'message'->>'text' AS text FROM telegram_updates WHERE id=2"))?.text).toBe('/start [redacted]');
  await bot.acceptUpdate({update_id:3,message:{text:`/start ${token}`,chat:{id:102,type:'private'},from:{id:102}}});await bot.telegramTick();expect((await db.one<{user_id:string}>('SELECT * FROM telegram_links'))?.user_id).toBe('101');
 });
 it('confirmation in bot changes admin order and debits only once',async()=>{
  const o=await orders.orderDetail(orderId);const callback={update_id:10,callback_query:{id:'cb10',data:`o:${orderId}:${o!.version}:confirmed`,from:{id:101},message:{message_id:1,chat:{id:101,type:'private'}}}};
  await bot.acceptUpdate(callback);await bot.acceptUpdate(callback);await bot.telegramTick();
  expect((await orders.orderDetail(orderId))?.status).toBe('confirmed');expect(await orders.currentStock(product)).toBe(0);
  await bot.acceptUpdate({...callback,update_id:11,callback_query:{...callback.callback_query,id:'cb11'}});await bot.telegramTick();expect(await orders.currentStock(product)).toBe(0);
  expect((await db.one<{n:string}>("SELECT COUNT(*) n FROM stock_moves WHERE product_id=$1 AND reason='order_confirm'",[product]))?.n).toBe('1');
 });
 it('delivery dialog stores cost and generates bilingual text',async()=>{
  await bot.acceptUpdate({update_id:119,callback_query:{id:'d119',data:`delivery:${orderId}`,from:{id:101},message:{message_id:2,chat:{id:101,type:'private'}}}});await bot.telegramTick();
  await bot.acceptUpdate({update_id:12,callback_query:{id:'d12',data:`d:${orderId}:pickup`,from:{id:101},message:{message_id:2,chat:{id:101,type:'private'}}}});await bot.telegramTick();
  await bot.acceptUpdate({update_id:13,message:{text:'0',from:{id:101},chat:{id:101,type:'private'}}});await bot.telegramTick();
  const o=await orders.orderDetail(orderId);expect(o?.deliveryCostMdl).toBe(0);const {getSettings}=await import('./checkout-db');const text=orders.messageTemplates(o!,await getSettings());expect(text.ru).toContain('подтверждён');expect(text.ro).toContain('confirmată');
 });
 it('confirmation completes immediately and offers optional customer messages and delivery changes',async()=>{
  await db.run("INSERT INTO catalog_products(id,name,sku,price_mdl,stock,price_mode) VALUES('qa-delivery','QA delivery','QA-DELIVERY',20,1,'fixed')");
  const order=await orders.createCallOrder(actor,{phone:'77700011',items:[{id:'qa-delivery',quantity:1}]});
  const before=(await orders.orderDetail(order.id))!;
  await bot.acceptUpdate({update_id:110,callback_query:{id:'cb110',data:`o:${order.id}:${before.version}:confirmed`,from:{id:101},message:{message_id:1,chat:{id:101,type:'private'}}}});await bot.telegramTick();
  const prompt=await db.one<{payload:{text:string;reply_markup:{inline_keyboard:{callback_data:string}[][]}}}>("SELECT payload FROM telegram_outbox WHERE dedupe LIKE 'reply:110:%'");
  expect(prompt?.payload.text).toContain(before.deliveryTitle);expect(prompt?.payload.reply_markup.inline_keyboard[0][0].callback_data).toBe(`lang:${order.id}:ru`);
  await bot.acceptUpdate({update_id:111,callback_query:{id:'cb111',data:`delivery:${order.id}`,from:{id:101},message:{message_id:1,chat:{id:101,type:'private'}}}});await bot.telegramTick();
  const after=(await orders.orderDetail(order.id))!;expect(after.deliveryMethod).toBe(before.deliveryMethod);expect(after.deliveryCostMdl).toBe(before.deliveryCostMdl);
  const choice=await db.one<{payload:{reply_markup:{inline_keyboard:{callback_data:string}[][]}}}>("SELECT payload FROM telegram_outbox WHERE dedupe LIKE 'reply:111:%'");expect(choice?.payload.reply_markup.inline_keyboard[0][0].callback_data).toMatch(`d:${order.id}:`);
 });
 it('issued closes CRM and queues privacy edits',async()=>{
  await db.run("INSERT INTO telegram_messages(chat_id,message_id,kind,entity_id) VALUES('101',777,'orders',$1)",[String(orderId)]);
  let o=(await orders.orderDetail(orderId))!;await orders.changeStatus(actor,orderId,'ready',o.version);o=(await orders.orderDetail(orderId))!;await orders.changeStatus(actor,orderId,'issued',o.version);await bot.telegramTick();
  expect((await crm.cases()).find(k=>k.id===caseId)?.stage).toBe('issued');
  const edit=await db.one<{payload:{text:string}}>("SELECT payload FROM telegram_outbox WHERE method='editMessageText' AND entity_id=$1 ORDER BY id DESC LIMIT 1",[String(orderId)]);expect(edit?.payload.text).not.toContain('+37377700002');expect(edit?.payload.text).toContain('Контакты скрыты');
 });
 it('tasks and refusal reasons validate input',async()=>{
  const id=await crm.call(actor,{phone:'77700002',need:'Новая деталь',source:'call'});
  await expect(crm.stage(actor,{id,version:1,stage:'refused',refusal:''})).rejects.toThrow('причину');
  await crm.addTask(actor,{caseId:id,title:'Перезвонить',dueAt:new Date(Date.now()-60000).toISOString()});expect((await crm.tasks()).some(t=>t.case_id===id)).toBe(true);
  const t=(await crm.tasks()).find(t=>t.case_id===id)!;await crm.completeTask(actor,t.id);expect((await crm.tasks()).some(item=>item.id===t.id)).toBe(false);
 });
 it('two orders cannot confirm the same last unit',async()=>{
  await db.run('UPDATE catalog_products SET stock=1 WHERE id=$1',[product]);const a=await orders.createCallOrder(actor,{phone:'77700003',items:[{id:product,quantity:1}]}),b=await orders.createCallOrder(actor,{phone:'77700004',items:[{id:product,quantity:1}]});
  const results=await Promise.allSettled([orders.changeStatus(actor,a.id,'confirmed',1),orders.changeStatus(actor,b.id,'confirmed',1)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(await orders.currentStock(product)).toBe(0);
 });
 it('unlinked people cannot use warehouse commands',async()=>{
  await db.run('UPDATE catalog_products SET stock=1 WHERE id=$1',[product]);await bot.acceptUpdate({update_id:30,message:{text:'/sold QA-001',from:{id:999},chat:{id:999,type:'private'}}});await bot.telegramTick();expect(await orders.currentStock(product)).toBe(1);
 });
 it('explains its role and how to use messages to an authorised operator',async()=>{
  await bot.acceptUpdate({update_id:129,message:{text:'/cancel',from:{id:101},chat:{id:101,type:'private'}}});
  await bot.acceptUpdate({update_id:130,message:{text:'/help',from:{id:101},chat:{id:101,type:'private'}}});
  await bot.acceptUpdate({update_id:131,message:{text:'Что ты умеешь?',from:{id:101},chat:{id:101,type:'private'}}});await bot.telegramTick();
  const help=await db.one<{payload:{text:string}}>("SELECT payload FROM telegram_outbox WHERE dedupe='menu:130'");expect(help?.payload.text).toContain('автоматически клиенту я его не отправляю');
  const fallback=await db.one<{payload:{text:string}}>("SELECT payload FROM telegram_outbox WHERE dedupe LIKE 'reply:131:%'");expect(fallback?.payload.text).toContain('/help');
 });
 it('offers a persistent menu and shows delivery as unconfirmed until explicitly saved',async()=>{
  await bot.acceptUpdate({update_id:140,message:{text:'/start',from:{id:101},chat:{id:101,type:'private'}}});await bot.telegramTick();
  const menu=await db.one<{payload:{reply_markup:{keyboard:{text:string}[][]}}}>("SELECT payload FROM telegram_outbox WHERE dedupe='menu:140'");expect(menu?.payload.reply_markup.keyboard.flat().map(b=>b.text)).toContain('📦 Новые заказы');
  const result=await orders.createCallOrder(actor,{phone:'77700012',items:[{id:product,quantity:1}]});let order=(await orders.orderDetail(result.id))!;expect(order.deliveryCostAgreed).toBe(false);
  await bot.acceptUpdate({update_id:141,message:{text:'📦 Новые заказы',from:{id:101},chat:{id:101,type:'private'}}});await bot.telegramTick();
  const message=await db.one<{payload:{text:string}}>('SELECT payload FROM telegram_outbox WHERE dedupe=$1',[`menu-order:141:${result.id}`]);expect(message?.payload.text).toContain('стоимость уточняется');expect(message?.payload.text).toContain('<code>');
  await orders.setDeliveryCost(actor,result.id,0,order.version);order=(await orders.orderDetail(result.id))!;expect(order.deliveryCostAgreed).toBe(true);
 });
 it('searches inquiry items by name and creates an order for the selected result',async()=>{
  await db.run('UPDATE catalog_products SET stock=1 WHERE id=$1',[product]);
  const inquiry=await db.one<{id:number}>("INSERT INTO inquiries(phone,part,vehicle,source,created_at) VALUES('+37377700013','QA','QA','expert',now()::text) RETURNING id");
  await bot.acceptUpdate({update_id:150,callback_query:{id:'i150',data:`i:${inquiry!.id}:order`,from:{id:101},message:{message_id:1,chat:{id:101,type:'private'}}}});await bot.telegramTick();
  await bot.acceptUpdate({update_id:151,message:{text:'тестовая',from:{id:101},chat:{id:101,type:'private'}}});await bot.telegramTick();
  const found=await db.one<{payload:{reply_markup:{inline_keyboard:{callback_data:string}[][]}}}>("SELECT payload FROM telegram_outbox WHERE dedupe LIKE 'reply:151:%'");expect(found?.payload.reply_markup.inline_keyboard[0][0].callback_data).toBe(`ip:${inquiry!.id}:${product}`);
  await bot.acceptUpdate({update_id:152,callback_query:{id:'i152',data:`ip:${inquiry!.id}:${product}`,from:{id:101},message:{message_id:1,chat:{id:101,type:'private'}}}});await bot.telegramTick();
  expect((await db.one<{status:string}>('SELECT status FROM inquiries WHERE id=$1',[inquiry!.id]))?.status).toBe('ordered');
 });
 it('respects the operator preference for new-order notifications',async()=>{
  await bot.telegramTick();await db.run('UPDATE telegram_links SET notify_orders=false WHERE staff_id=$1',[actor.id]);
  const result=await orders.createCallOrder(actor,{phone:'77700014',items:[{id:product,quantity:1}]});await bot.telegramTick();
  expect(await db.one('SELECT id FROM telegram_outbox WHERE dedupe=$1',[`new:orders:${result.id}:101`])).toBeNull();
  await db.run('UPDATE telegram_links SET notify_orders=true WHERE staff_id=$1',[actor.id]);
 });
 it('merged phones keep one client for future calls and orders',async()=>{
  const a=await crm.call(actor,{phone:'77700005',name:'Original',need:'Деталь',source:'call'}),b=await crm.call(actor,{phone:'77700006',name:'Target',need:'Деталь',source:'call'});
  const ca=(await crm.cases()).find(k=>k.id===a)!.client_id,cb=(await crm.cases()).find(k=>k.id===b)!.client_id;
  await crm.mergeClients(actor,ca,cb);const next=await crm.call(actor,{phone:'077700005',need:'Ещё деталь',source:'call'});expect((await crm.cases()).find(k=>k.id===next)?.client_id).toBe(cb);expect((await crm.clientDetail(cb)).cases).toHaveLength(3);
 });
 it('new stock prepares an operator notification for a waiting client',async()=>{
  const id=await crm.call(actor,{phone:'77700007',name:'Waiting',need:'Фара',source:'call'});await crm.waitForPart(actor,{caseId:id,query:'Фара'});
  await db.run('UPDATE catalog_products SET stock=0 WHERE id=$1',[product]);await db.run('UPDATE catalog_products SET stock=1 WHERE id=$1',[product]);await bot.telegramTick();
  expect(await db.one("SELECT id FROM telegram_outbox WHERE dedupe LIKE 'arrival:%' AND payload->>'text' LIKE '%Waiting%' ")).not.toBeNull();
 });
 it('Postgres repositories retain donor, product, pages and account behavior',async()=>{
  const parts=await import('./parts-db'),pages=await import('./pages-db'),accounts=await import('./customer-db');
  // П6: обязательны тип детали, бренд, хотя бы одно фото и цена (или «по запросу»).
  await db.run("INSERT INTO ref_part_types(id,name_ru,created_at) VALUES('qa-type','Фара',now()::text) ON CONFLICT DO NOTHING");
  await db.run("INSERT INTO ref_brands(id,name,created_at) VALUES('qa-brand','QA Brand',now()::text) ON CONFLICT DO NOTHING");
  const sharp=(await import('sharp')).default;const photo=`data:image/png;base64,${(await sharp({create:{width:64,height:48,channels:3,background:'#888'}}).png().toBuffer()).toString('base64')}`;
  const donorId=await parts.saveDonor(actor,{make:'QA',model:'Model',year:2013});
  await expect(parts.addPart(actor,{partTypeId:'qa-type',brandId:'qa-brand',photos:[],price:700,donorId})).rejects.toThrow('фото');
  const part=await parts.addPart(actor,{nameRu:'Фара PostgreSQL',partTypeId:'qa-type',brandId:'qa-brand',photos:[{src:photo,closeup:false}],condition:'good',price:700,stock:1,donorId});
  expect(part.sku).toMatch(/^NAA-\d{6}$/);
  expect((await parts.partById(part.id))?.donorTitle).toContain('2013');expect((await parts.partsOfDonor(donorId))).toHaveLength(1);
  const pageId=await pages.savePage(actor,{slug:'qa-page',titleRu:'Тестовая страница',bodyRu:'Текст'});await pages.setPageVisible(actor,pageId,false);expect(await pages.findPage('qa-page')).toBeNull();
  const account=await accounts.registerCustomer({name:'QA Customer',surname:'Test',email:'qa@naa.test',phone:'77700008',password:'QaPassword2026',agreed:true});expect(account.customer.id).toBeGreaterThan(0);expect(await accounts.loginCustomer('77700008','QaPassword2026')).not.toBeNull();
 });
 it('STO discount is applied to offers and orders on the server',async()=>{
  const id=await crm.call(actor,{phone:'77700009',name:'СТО',need:'Фара',source:'call'}),clientId=(await crm.cases()).find(k=>k.id===id)!.client_id;
  await crm.saveClient(actor,{id:clientId,name:'СТО',kind:'sto',discount:10});expect(await crm.offer(actor,id,[product])).toContain('450 руб.');
  const o=await orders.createCallOrder(actor,{phone:'77700009',items:[{id:product,quantity:1}]});expect((await orders.orderDetail(o.id))?.totalMdl).toBe(450);
 });
 it('outbox retains failed sends and retries',async()=>{
  process.env.TELEGRAM_BOT_TOKEN='test-token';const fetchMock=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response(JSON.stringify({ok:false,description:'Too Many Requests',parameters:{retry_after:1}}),{status:429}));
  await bot.enqueue('retry-test','sendMessage',{chat_id:'101',text:'Retry'});await bot.flushOutbox();const failed=await db.one<{attempts:number;sent_at:unknown}>("SELECT * FROM telegram_outbox WHERE dedupe='retry-test'");expect(failed?.attempts).toBeGreaterThan(0);expect(failed?.sent_at).toBeNull();
  fetchMock.mockImplementation(async()=>new Response(JSON.stringify({ok:true,result:{message_id:500}})));await db.run("UPDATE telegram_outbox SET next_at=now() WHERE sent_at IS NULL");await bot.flushOutbox();expect((await db.one<{sent_at:unknown}>("SELECT sent_at FROM telegram_outbox WHERE dedupe='retry-test'"))?.sent_at).toBeTruthy();delete process.env.TELEGRAM_BOT_TOKEN;fetchMock.mockRestore();
 });
 it('working hours use Chisinau timezone',()=>{expect(bot.workingTime(new Date('2026-11-16T04:00:00Z')).open).toBe(false);expect(bot.workingTime(new Date('2026-11-16T07:00:00Z')).open).toBe(true);expect(bot.workingTime(new Date('2026-11-16T18:00:00Z')).open).toBe(false);});
 it('limits advertising to active dates, authorised owners, and one booking per place',async()=>{const ads=await import('./advertising');const data={advertiser:'QA advertiser',phone:'+37377700001',image:'/uploads/qa-banner.webp',url:'https://example.com/',placement:'catalog',start_at:new Date(Date.now()-60000).toISOString(),end_at:new Date(Date.now()+60000).toISOString(),price_mdl:100,enabled:true};await expect(ads.saveBanner({...actor,role:'operator'},data)).rejects.toThrow();await expect(ads.saveBanner(actor,{...data,url:'javascript:alert(1)'})).rejects.toThrow();await ads.saveBanner(actor,data);const live=await ads.activeBanner('catalog');expect(live?.advertiser).toBe('QA advertiser');await expect(ads.saveBanner(actor,data)).rejects.toThrow();await db.run("INSERT INTO ad_events(banner_id,kind) VALUES($1,'view'),($1,'click')",[live!.id]);const report=await ads.bannerReport(live!.report_token);expect(report?.views).toBe(1);expect(report?.clicks).toBe(1);await db.run("UPDATE ad_banners SET end_at=now()-interval '1 second' WHERE id=$1",[live!.id]);expect(await ads.activeBanner('catalog')).toBeNull();});
 it('queues one banner-expiry reminder for the owner during working hours',async()=>{const ads=await import('./advertising');await ads.saveBanner(actor,{advertiser:'Expiry QA',phone:'+37377700001',image:'/uploads/qa-banner.webp',url:'https://example.com/',placement:'product',start_at:new Date(Date.now()-60000).toISOString(),end_at:new Date(Date.now()+86400000).toISOString(),price_mdl:100,enabled:true});const now=new Date();now.setUTCHours(10,0,0,0);vi.useFakeTimers();vi.setSystemTime(now);try{await bot.telegramTick();await bot.telegramTick();const rows=await db.many<{dedupe:string}>("SELECT dedupe FROM telegram_outbox WHERE dedupe LIKE 'ad-expiry:%' AND payload->>'text' LIKE '%Expiry QA%'");expect(rows).toHaveLength(1);}finally{vi.useRealTimers();}});
 it('publishes articles only after owner approval',async()=>{const news=await import('./news');const data={slug:'qa-article',title_ru:'QA article',body_ru:'Test article contents',topic:'Новости магазина',published_at:new Date().toISOString(),published:false};await expect(news.saveArticle({...actor,role:'operator'},data)).rejects.toThrow();await news.saveArticle(actor,data);expect(await news.article('qa-article')).toBeNull();const row=await db.one<{id:number}>("SELECT id FROM news_articles WHERE slug='qa-article'");await news.saveArticle(actor,{...data,id:row!.id,published:true});expect((await news.article('qa-article'))?.title_ru).toBe('QA article');});
 it('keeps reviews private until moderation and prevents duplicate phone reviews',async()=>{const reviews=await import('./reviews');process.env.OPERATIONS_SECRET='test-only-secret';const c=reviews.challenge(),[a,b]=c.question.split(' + ').map(Number),data={product_id:product,name:'Review QA',phone:'+37377700017',body:'Useful test review',rating:5,token:c.token,answer:a+b};await expect(reviews.submitReview({...data,answer:0})).rejects.toThrow();await reviews.submitReview(data);expect(await reviews.publicReviews(product)).toHaveLength(0);await expect(reviews.submitReview(data)).rejects.toThrow();const row=await db.one<{id:number}>("SELECT id FROM product_reviews WHERE name='Review QA'");await reviews.moderateReview(actor,{id:row!.id,status:'published',reply:'Спасибо'});const items=await reviews.publicReviews(product);expect(items).toHaveLength(1);expect(items[0]).not.toHaveProperty('phone');expect((await reviews.rating(product))?.average).toBe(5);await reviews.moderateReview(actor,{id:row!.id,status:'hidden'});expect(await reviews.publicReviews(product)).toHaveLength(0);});
 it('accepts a vacancy application and notifies only owners without candidate contacts',async()=>{
  const jobs=await import('./vacancies');await jobs.saveVacancy(actor,{title:'QA vacancy',description:'A real test description',location:'Slobozia',schedule:'9–18',is_open:true});const job=(await jobs.vacancies())[0];
  await expect(jobs.saveVacancy({...actor,role:'operator'}, {title:'No access',description:'A real test description'})).rejects.toThrow();
  await expect(jobs.applyVacancy({vacancyId:job.id,name:'Candidate',phone:'+37377700015',messenger:'phone',agreed:false})).rejects.toThrow();
  const operator=await db.one<{id:number}>("INSERT INTO staff_users(name,phone,role) VALUES('QA operator','+37377700016','operator') RETURNING id");await db.run("INSERT INTO telegram_links(staff_id,user_id,chat_id) VALUES($1,'202','202')",[operator!.id]);
  const id=await jobs.applyVacancy({vacancyId:job.id,name:'Candidate',phone:'+37377700015',messenger:'phone',agreed:true});await bot.telegramTick();
  const message=await db.one<{payload:{text:string}}>("SELECT payload FROM telegram_outbox WHERE dedupe LIKE 'vacancy:%' AND payload->>'text' LIKE '%QA vacancy%' ORDER BY id DESC LIMIT 1");expect(message?.payload.text).toContain('QA vacancy');expect(message?.payload.text).not.toContain('Candidate');expect(message?.payload.text).not.toContain('77700015');expect(await db.one("SELECT id FROM telegram_outbox WHERE dedupe LIKE 'vacancy:%' AND payload->>'chat_id'='202'")).toBeNull();expect(id).toBeGreaterThan(0);
 });
});
