// Run alongside the app. Polling works locally without a public webhook.
import {readFileSync,existsSync} from 'node:fs';
import pg from 'pg';
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=/^([A-Z_]+)=(.*)$/.exec(line.trim());if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const origin=process.env.OPERATIONS_APP_URL??'http://localhost:3000';
if(!process.env.OPERATIONS_SECRET)throw new Error('Set OPERATIONS_SECRET in .env.local');
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});let stopping=false;
process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
async function cycle(){try{if(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_TRANSPORT!=='webhook'){
 const offset=await db.query("SELECT value FROM telegram_state WHERE key='offset'");
 const r=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({offset:Number(offset.rows[0]?.value??0),timeout:10,allowed_updates:['message','callback_query']}),signal:AbortSignal.timeout(15000)});
 const body=await r.json();if(!body.ok)throw new Error('Telegram polling failed. Check token and transport.');
 for(const update of body.result){const chat=update.message?.chat??update.callback_query?.message?.chat;if(chat?.type==='private')await db.query('INSERT INTO telegram_updates(id,payload) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[update.update_id,JSON.stringify(update)]);await db.query("INSERT INTO telegram_state(key,value) VALUES('offset',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[String(update.update_id+1)]);}}}catch(e){console.error('Telegram polling:',e instanceof Error?e.message:'error');}
 const tick=await fetch(origin+'/api/operations/tick',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPERATIONS_SECRET}`},signal:AbortSignal.timeout(60000)});if(!tick.ok)throw new Error(`Operations tick HTTP ${tick.status}`);await db.query("INSERT INTO telegram_state(key,value) VALUES('worker_heartbeat',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[new Date().toISOString()]);}
console.log('Operations worker started');
try{while(!stopping){try{await cycle();}catch(e){console.error(e instanceof Error?e.message:'Worker error');}if(!stopping)await new Promise(r=>setTimeout(r,2000));}}finally{await db.end();}
