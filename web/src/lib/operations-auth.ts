import { timingSafeEqual } from 'node:crypto';
export function matchesSecret(received:string|null,expected:string|undefined){if(!received||!expected)return false;const a=Buffer.from(received),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
