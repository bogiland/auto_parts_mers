import './env.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
const tokenFile=process.argv.indexOf('--token-file');
const token=tokenFile>=0?readFileSync(process.argv[tokenFile+1],'utf8').trim():process.env.TELEGRAM_BOT_TOKEN;
if(!token)throw new Error('Нужен TELEGRAM_BOT_TOKEN или --token-file с защищённым файлом.');
async function api(method,data={}){let response;try{response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});}catch{throw new Error('Не удалось связаться с Telegram.');}const body=await response.json();if(!body.ok)throw new Error(`Telegram отклонил ${method}: ${body.description??'ошибка'}`);return body.result;}
const bot=await api('getMe');
let env=readFileSync('.env.local','utf8');
for(const [key,value]of Object.entries({TELEGRAM_BOT_TOKEN:token,TELEGRAM_BOT_USERNAME:bot.username})){const re=new RegExp(`^${key}=.*$`,'m');env=re.test(env)?env.replace(re,`${key}=${value}`):env+`\n${key}=${value}\n`;}
if(process.env.TELEGRAM_TRANSPORT==='webhook'){
 const base=process.env.NEXT_PUBLIC_SITE_URL;if(!base?.startsWith('https://')||!process.env.TELEGRAM_WEBHOOK_SECRET)throw new Error('Для webhook нужны HTTPS NEXT_PUBLIC_SITE_URL и TELEGRAM_WEBHOOK_SECRET.');
 await api('setWebhook',{url:base.replace(/\/$/,'')+'/api/telegram/webhook',secret_token:process.env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message','callback_query']});
}else await api('deleteWebhook',{drop_pending_updates:false});
writeFileSync('.env.local',env);console.log(`Подключён @${bot.username}. Перезапустите приложение и worker, затем откройте «Мой профиль → Подключить Telegram».`);
