// Deterministic snapshot identity, not a cryptographic security signature.
export function inputFingerprint(input){
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 let hash=14695981039346656037n;for(const c of new TextEncoder().encode(JSON.stringify(stable(input))))hash=BigInt.asUintN(64,(hash^BigInt(c))*1099511628211n);
 return 'fnv1a64-'+hash.toString(16).padStart(16,'0');
}
