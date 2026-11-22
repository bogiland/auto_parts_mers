import {applyVacancy} from '@/lib/vacancies';
import {sameOrigin} from '@/lib/staff-auth';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response(null,{status:403});
 const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400});
 const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>12000){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))return new Response(null,{status:400});
 await applyVacancy(body);return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const message=e instanceof Error?e.message:'';if(['Проверьте имя, телефон, мессенджер и согласие.','Вакансия закрыта.'].includes(message))return Response.json({message},{status:400});return Response.json({message:'Не удалось отправить отклик. Попробуйте позже.'},{status:400});}}
