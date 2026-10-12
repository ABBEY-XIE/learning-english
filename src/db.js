const NAME = 'roam-speaking-v1';
let opening;
function requestResult(request) { return new Promise((resolve,reject)=> { request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error || new Error('本机存储读取失败')); }); }
export function openDB() {
  if (!opening) opening = new Promise((resolve,reject)=> {
    if (!globalThis.indexedDB) return reject(new Error('浏览器不支持本机保存，请换用Safari或Chrome的普通模式。'));
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded=()=> { for (const name of ['records','meta','drafts']) if (!r.result.objectStoreNames.contains(name)) r.result.createObjectStore(name, {keyPath:'id'}); };
    r.onsuccess=()=> {r.result.onversionchange=()=>r.result.close();resolve(r.result);};
    r.onerror=()=> {opening=null;reject(r.error || new Error('本机存储无法打开'));};
    r.onblocked=()=> {opening=null;reject(new Error('请关闭其他旧版练习页面后重试。'));};
  });
  return opening;
}
export async function get(store,id) { const db=await openDB(); return requestResult(db.transaction(store).objectStore(store).get(id)); }
export async function all(store) { const db=await openDB(); return requestResult(db.transaction(store).objectStore(store).getAll()); }
export async function put(store,value) {
  const db=await openDB();
  return new Promise((resolve,reject)=> {
    const tx=db.transaction(store,'readwrite');
    tx.oncomplete=()=>resolve(value); tx.onerror=tx.onabort=()=>reject(tx.error || new Error('本机保存失败，可能空间不足。请先下载这段录音。'));
    try {tx.objectStore(store).put(value);} catch(e) {reject(e);}
  });
}
export async function remove(store,id) {
  const db=await openDB(); return new Promise((resolve,reject)=> {const tx=db.transaction(store,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error || new Error('删除失败'));tx.objectStore(store).delete(id);});
}
export async function metaGet(id, fallback=null) {return (await get('meta',id))?.value ?? fallback;}
export const metaSet=(id,value)=>put('meta',{id,value});
export async function scopeRecords(scope) {return (await all('records')).filter(r=>r.scope===scope).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
export async function recoverDrafts(scope) {
  const drafts=(await all('drafts')).filter(d=>d.scope===scope);let recovered=0;
  for(const d of drafts) {
    if (!(await get('records',d.id)) && d.blob?.size) {
      await put('records',{...d,recovered:true,sync:'local',transcript:'',feedback:null,deleted:false});recovered++;
    }
    await remove('drafts',d.id);
  }
  return recovered;
}

/** Atomic restore: either all selected data and metadata commit, or none do. */
export async function batch(entries) {
 const db=await openDB();const stores=[...new Set(entries.map(e=>e.store))];
 return new Promise((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error||new Error('恢复未写入：本机存储空间不足或写入失败。原有数据不变。'));try{for(const entry of entries)tx.objectStore(entry.store).put(entry.value);}catch(e){tx.abort();reject(e);}});
}
