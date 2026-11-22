process.env.NAA_FIRST_OWNER='1';
if(process.argv.length===4)process.argv.push('owner');
await import('./create-staff.mjs');
