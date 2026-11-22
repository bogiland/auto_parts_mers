import './env.mjs';
import pg from 'pg';
import {randomBytes,scryptSync} from 'node:crypto';
import {createInterface} from 'node:readline';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
try{
 const args=process.argv.slice(2);
 if(args[0]==='--list'){for(const row of (await db.query('SELECT id,name,phone,role,active FROM staff_users ORDER BY id')).rows)console.log(`${row.id}\t${row.role}\t${row.phone}\t${row.name}${row.active?'':' (выключен)'}`);}
 else{
  const name=args[0]?.trim()??'',digits=String(args[1]??'').replace(/\D/g,''),phone=digits.startsWith('373')?'+'+digits:'+373'+digits.replace(/^0+/,'');
  const role=args[2]??'operator';if(name.length<2||!/^\+\d{8,15}$/.test(phone)||!['owner','operator'].includes(role))throw new Error('Использование: npm run staff:create -- "Имя" "77712345" owner|operator');
  let password='';if(process.stdin.isTTY){const reader=createInterface({input:process.stdin,output:process.stdout});password=await new Promise(resolve=>reader.question('Пароль (не менее 12 символов): ',resolve));reader.close();}else for await(const chunk of process.stdin)password+=chunk.toString();
  password=password.trimEnd();if(password.length<12)throw new Error('Пароль должен содержать не менее 12 символов.');
  const salt=randomBytes(16),hash=`${salt.toString('hex')}:${scryptSync(password,salt,64).toString('hex')}`;
  await db.query('BEGIN');await db.query('LOCK TABLE staff_users IN SHARE ROW EXCLUSIVE MODE');
  if(process.env.NAA_FIRST_OWNER==='1'&&Number((await db.query("SELECT COUNT(*) n FROM staff_users WHERE role='owner' AND active=1")).rows[0].n))throw new Error('Owner уже существует. Новых сотрудников добавляйте в админке.');
  const row=(await db.query('INSERT INTO staff_users(name,phone,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(phone) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,role=EXCLUDED.role,active=1,customer_id=NULL RETURNING id',[name,phone,hash,role])).rows[0];
  await db.query('UPDATE staff_sessions SET revoked=1 WHERE user_id=$1',[row.id]);await db.query('DELETE FROM login_attempts WHERE phone=$1',[phone]);await db.query('COMMIT');console.log(`Сотрудник сохранён: ${name}, ${phone}, ${role}. Вход: /admin/login`);
 }
}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{await db.end();}
