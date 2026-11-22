import { existsSync,readFileSync } from 'node:fs';
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=/^([A-Z_]+)=(.*)$/.exec(line.trim());if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
