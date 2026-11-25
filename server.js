// Static site server with simple, cookie-free analytics.
// POST /t records time per section and a few events. GET /stats?key=STATS_KEY shows the summary.
const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'site'),PORT=process.env.PORT||8080,KEY=process.env.STATS_KEY||'';
const DATA=process.env.DATA_DIR||(fs.existsSync('/data')?'/data':'/tmp'),LOG=path.join(DATA,'events.ndjson');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.txt':'text/plain','.svg':'image/svg+xml','.ico':'image/x-icon'};
const NAMES={top:'Banner',idea:'Idea',worlds:'Worlds',crew:'Crew',story:'Story and film',script:'Script',game:'Game',craft:'Craft',other:'Between sections'};
const EV={film_play:'Played the film',film_finished:'Watched the film to the end',game_played:'Played the game',story_player_used:'Used the shot-by-shot player',script_line_clicked:'Clicked a script line',worlds_used:'Switched worlds',crew_used:'Opened a crew card'};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=s=>{s=Math.round(s);return s>=60?Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s':s+'s'};

function track(req,res){let b='';req.on('data',c=>{b+=c;if(b.length>4096)req.destroy()});req.on('end',()=>{try{const j=JSON.parse(b);const rec={t:Date.now(),v:String(j.v||'').slice(0,24),d:{},e:[],w:+j.w||0,r:String(j.r||'').slice(0,80)};
  for(const k in j.d||{})if(NAMES[k])rec.d[k]=Math.min(15,Math.max(0,+j.d[k]||0));
  for(const e of (j.e||[]).slice(0,12))if(e==='visit'||EV[e])rec.e.push(e);
  if(rec.v)fs.appendFile(LOG,JSON.stringify(rec)+'\n',()=>{})}catch(e){}res.writeHead(204);res.end()})}

function stats(res){let lines=[];try{lines=fs.readFileSync(LOG,'utf8').split('\n').filter(Boolean)}catch(e){}
  const V=new Map();for(const l of lines){let r;try{r=JSON.parse(l)}catch(e){continue}let v=V.get(r.v);if(!v){v={first:r.t,last:r.t,d:{},e:new Set(),w:r.w,r:r.r};V.set(r.v,v)}v.last=r.t;for(const k in r.d)v.d[k]=(v.d[k]||0)+r.d[k];for(const e of r.e)v.e.add(e)}
  const vis=[...V.values()].map(v=>({...v,total:Object.values(v.d).reduce((a,b)=>a+b,0)})).sort((a,b)=>b.first-a.first);
  const real=vis.filter(v=>v.total>=3),sum={},reach={};let all=0;
  for(const v of real)for(const k in v.d){sum[k]=(sum[k]||0)+v.d[k];all+=v.d[k];if(v.d[k]>=2)reach[k]=(reach[k]||0)+1}
  const rows=Object.keys(sum).sort((a,b)=>sum[b]-sum[a]).map(k=>`<tr><td>${NAMES[k]}</td><td class="bar"><i style="width:${(sum[k]/(all||1)*100).toFixed(1)}%"></i></td><td>${(sum[k]/(all||1)*100).toFixed(0)}%</td><td>${fmt(sum[k])}</td><td>${fmt(sum[k]/(reach[k]||1))}</td><td>${reach[k]||0} of ${real.length}</td></tr>`).join('');
  const evr=Object.keys(EV).map(k=>{const n=real.filter(v=>v.e.has(k)).length;return `<tr><td>${EV[k]}</td><td>${n} of ${real.length}</td></tr>`}).join('');
  const dev=w=>w?w<700?'Phone':w<1100?'Tablet':'Desktop':'';
  const tf=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const rec=vis.slice(0,40).map(v=>{const top=Object.keys(v.d).sort((a,b)=>v.d[b]-v.d[a])[0];return `<tr><td>${tf.format(v.first)}</td><td>${dev(v.w)}</td><td>${fmt(v.total)}</td><td>${top?NAMES[top]:''}</td><td>${[...v.e].filter(e=>EV[e]).map(e=>EV[e]).join(', ')}</td><td>${esc(v.r)}</td></tr>`}).join('');
  const avg=real.length?all/real.length:0;
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex'});
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flavor Friends site stats</title><style>
body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px 16px 60px;background:#fff8ec;color:#22140f}main{max-width:900px;margin:auto}h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:34px 0 8px}
.k{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}.k div{background:#fff;border:1px solid #e9d7bf;border-radius:12px;padding:12px 16px;min-width:120px}.k b{display:block;font-size:24px}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #e9d7bf}td,th{padding:8px 10px;border-bottom:1px solid #f0e3cf;text-align:left;white-space:nowrap}th{font-size:12px;color:#6b5446}
.bar{width:35%;min-width:90px}.bar i{display:block;height:12px;border-radius:6px;background:#d11f2e;min-width:2px}p{color:#6b5446;margin:6px 0}
@media(prefers-color-scheme:dark){body{background:#1b1012;color:#fbefe0}table,.k div{background:#24161a;border-color:#3a2430}td,th{border-color:#3a2430}th,p{color:#cdb9a6}}
</style><main><h1>Flavor Friends site stats</h1><p>Times count only while the tab is open and the visitor is active. Visits under 3 seconds are left out of the averages.</p>
<div class="k"><div><b>${real.length}</b>visits</div><div><b>${fmt(avg)}</b>average time on site</div><div><b>${fmt(all)}</b>total time</div><div><b>${vis.length-real.length}</b>bounces under 3s</div></div>
<h2>Where people spend time</h2><div class="tw"><table><tr><th>Section</th><th></th><th>Share</th><th>Total</th><th>Average when seen</th><th>Visits that saw it</th></tr>${rows||'<tr><td colspan="6">No visits yet.</td></tr>'}</table></div>
<h2>What people did</h2><div class="tw"><table><tr><th>Action</th><th>Visits</th></tr>${evr}</table></div>
<h2>Recent visits</h2><div class="tw"><table><tr><th>When (New York)</th><th>Device</th><th>Time</th><th>Most time in</th><th>Actions</th><th>Came from</th></tr>${rec||'<tr><td colspan="6">No visits yet.</td></tr>'}</table></div></main></html>`)}

function file(req,res,u){let p=decodeURIComponent(u.pathname);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,path.normalize(p));
  if(!f.startsWith(ROOT))return res.writeHead(403).end();
  fs.stat(f,(err,st)=>{if(err||!st.isFile()){res.writeHead(404,{'content-type':'text/plain'});return res.end('Not found')}
    const ext=path.extname(f).toLowerCase(),h={'content-type':TYPES[ext]||'application/octet-stream','x-robots-tag':'noindex, nofollow','accept-ranges':'bytes','cache-control':ext==='.html'?'no-cache':'public, max-age=3600'};
    const rg=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range||'');
    if(rg&&(rg[1]||rg[2])){let s=rg[1]?+rg[1]:Math.max(0,st.size-+rg[2]),e=rg[1]&&rg[2]?Math.min(+rg[2],st.size-1):st.size-1;if(s>e||s>=st.size){res.writeHead(416,{'content-range':`bytes */${st.size}`});return res.end()}
      h['content-range']=`bytes ${s}-${e}/${st.size}`;h['content-length']=e-s+1;res.writeHead(206,h);if(req.method==='HEAD')return res.end();return fs.createReadStream(f,{start:s,end:e}).pipe(res)}
    if((ext==='.html'||ext==='.js'||ext==='.css'||ext==='.txt')&&/\bgzip\b/.test(req.headers['accept-encoding']||'')){h['content-encoding']='gzip';h.vary='Accept-Encoding';res.writeHead(200,h);if(req.method==='HEAD')return res.end();return fs.createReadStream(f).pipe(zlib.createGzip()).pipe(res)}
    h['content-length']=st.size;res.writeHead(200,h);if(req.method==='HEAD')return res.end();fs.createReadStream(f).pipe(res)})}

http.createServer((req,res)=>{const u=new URL(req.url,'http://x');
  if(u.pathname==='/t'&&req.method==='POST')return track(req,res);
  if(u.pathname==='/stats'){if(!KEY||u.searchParams.get('key')!==KEY){res.writeHead(404,{'content-type':'text/plain'});return res.end('Not found')}return stats(res)}
  if(req.method!=='GET'&&req.method!=='HEAD')return res.writeHead(405).end();
  file(req,res,u)}).listen(PORT,()=>console.log('listening on '+PORT+', data in '+DATA));
