import "server-only";
import {one} from '@/lib/db';
export async function clientDiscount(phone:string){const row=await one<{discount:number}>(`SELECT discount FROM crm_clients WHERE kind='sto' AND (phone=crm_phone($1) OR id IN(SELECT client_id FROM crm_phone_aliases WHERE phone=crm_phone($1))) LIMIT 1`,[phone]);return row?.discount??0;}
export function discountedPrice(price:number,discount:number){return Math.round(price*(100-discount)/100);}
