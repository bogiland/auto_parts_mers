import '../scripts/env.mjs';
import {chromium} from 'playwright';
import pg from 'pg';
import {randomBytes,scryptSync} from 'node:crypto';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const tag='QA-'+randomBytes(5).toString('hex'),secret=randomBytes(18).toString('hex'),salt=randomBytes(16),hash=`${salt.toString('hex')}:${scryptSync(secret,salt,64).toString('hex')}`;
const phone='+373777'+String(Math.floor(Math.random()*90000+10000));
const staff=(await db.query("INSERT INTO staff_users(name,phone,password_hash,role) VALUES($1,$2,$3,'owner') RETURNING id",[tag,phone,hash])).rows[0];
const root=process.env.QA_BASE_URL??'http://localhost:3000',browser=await chromium.launch({channel:'chrome'});const errors=[];let clientId;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const login=await context.request.post(root+'/api/staff/login',{headers:{origin:root},data:{phone,password:secret}});if(!login.ok())throw new Error('Login '+login.status());
 const created=await context.request.post(root+'/api/staff/crm',{headers:{origin:root},data:{action:'call',phone:'+373600'+String(Math.floor(Math.random()*90000+10000)),name:tag,need:'Тестовая фара',source:'call'}});if(!created.ok())throw new Error(await created.text());const id=(await created.json()).id;
 clientId=(await db.query('SELECT client_id FROM crm_cases WHERE id=$1',[id])).rows[0].client_id;
 let page=await context.newPage();page.on('console',m=>{if(m.type()==='error')console.log('Console:',m.text().slice(0,400))});page.on('requestfailed',r=>console.log('Request failed:',r.url(),r.failure()?.errorText));page.on('pageerror',e=>{errors.push(e.message);console.log('Browser error:',e.message)});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});for(const path of ['requests','clients','tasks','profile','reports']){await page.close();page=await context.newPage();await page.setViewportSize({width,height:1000});page.on('pageerror',e=>errors.push(e.message));const response=await page.goto(`${root}/admin/${path}`,{waitUntil:'load'});if(response.status()!==200)throw new Error(`${path}: ${response.status()}`);console.log(path,width);await page.locator('.admin-shell[data-ready="1"]').waitFor({timeout:15000}).catch(async e=>{console.log(await page.evaluate(()=>({ready:document.readyState,scripts:document.scripts.length,resources:performance.getEntriesByType('resource').map(e=>e.name).slice(-12)})));console.log((await page.locator('body').innerText()).slice(0,1200));await page.screenshot({path:'qa/shots/crm-failure.png',fullPage:true});throw e;});if(path!=='profile')await page.getByRole('button',{name:'☎ Звонок',exact:true}).waitFor();if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)){console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1&&r.width>0}).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,text:e.textContent?.slice(0,80)})).slice(0,18)));await page.screenshot({path:'qa/shots/crm-overflow.png',fullPage:true});throw new Error(`Overflow ${path} ${width}`);}await page.screenshot({path:`qa/shots/crm-${path}-${width}.png`,fullPage:true});}}
 if(errors.length)throw new Error(errors.join('\n'));console.log('CRM pages: 1440 and 390px passed; no browser errors');
}finally{
 if(clientId){await db.query('DELETE FROM crm_events WHERE client_id=$1',[clientId]);await db.query('DELETE FROM crm_cases WHERE client_id=$1',[clientId]);await db.query('DELETE FROM crm_clients WHERE id=$1',[clientId]);}
 await db.query('DELETE FROM staff_sessions WHERE user_id=$1',[staff.id]);await db.query('DELETE FROM staff_audit WHERE actor_id=$1',[staff.id]);await db.query('DELETE FROM login_attempts WHERE phone=$1',[phone]);await db.query('DELETE FROM staff_users WHERE id=$1',[staff.id]);await browser.close();await db.end();
}
