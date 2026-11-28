(function(){
const hex=n=>[...crypto.getRandomValues(new Uint8Array(n))].map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,n);
const seed={
 comunidades:{c1:{nome:"Comunidade Azul",goms:"Gabi e Duda"},c2:{nome:"Outra",goms:"Ana"}},
 cegs:{g1:{nome:"Caixa 2 PHP",comunidade:"Comunidade Azul",gom:"Gabi"},g2:{nome:"Variados 7",comunidade:"Comunidade Azul",gom:"Gabi"},g3:{nome:"Set Seung",comunidade:"Outra",gom:"Ana"}},
 itens:{i1:{item:"Han Aladin",membro:"HAN",ceg:"Caixa 2 PHP",comunidade:"Comunidade Azul",status:"Garantido"},i2:{item:"Felix LD",membro:"Felix",ceg:"Caixa 2 PHP",comunidade:"Comunidade Azul",status:"Com a GOM no Brasil",etiquetas:"troca"},i3:{item:"Seung set",membro:"Seungmin",ceg:"Set Seung",comunidade:"Outra",status:"Envio liberado"},i4:{item:"Chan pob",membro:"Bang Chan",ceg:"Variados 7",comunidade:"Comunidade Azul",status:"Recebido"}},
 cobrancas:{k1:{referente:"frete",ceg:"Caixa 2 PHP",comunidade:"Comunidade Azul",valor:18.4,status:"Pendente",prazo:"2026-12-01"}},
 fotos:{},colecao:{},cardsnovos:{},cegs2:{}
};
// testes podem somar dados com window.__seedExtra = {colecao:{id:{...}}} antes de carregar este arquivo
const ex=window.__seedExtra||{}; for(const c in ex)seed[c]={...(seed[c]||{}),...ex[c]};
const store={}; const subs={};
for(const c in seed){store[c]=new Map(Object.entries(seed[c]).map(([k,v])=>[k,JSON.parse(JSON.stringify(v))]));subs[c]=new Set()}
const fire=c=>{(subs[c]||[]).forEach(f=>f())};
const snap=c=>({docs:[...(store[c]||new Map())].map(([id,d])=>({id,data:()=>d}))});

const db={
 collection:c=>{store[c]=store[c]||new Map();subs[c]=subs[c]||new Set();return{limit(){return this},onSnapshot(cb){const f=()=>cb(snap(c));subs[c].add(f);setTimeout(f,0);return()=>subs[c].delete(f)},async add(d){const id=hex(10);store[c].set(id,d);fire(c);return{id}}}},
 doc:p=>{const i=p.indexOf("/"),c=p.slice(0,i),id=p.slice(i+1);store[c]=store[c]||new Map();return{async set(d){store[c].set(id,d);fire(c)},async update(pt){store[c].set(id,{...store[c].get(id),...pt});fire(c)},async delete(){store[c].delete(id);fire(c)}}}
};
const V2=window.__MODELO==="v2";
if(!V2){
window.__store=store;window.__fire=fire;
window.claude={use:async n=>n==="db"?db:n==="user"?{can:async()=>true}:n==="assets"?{upload:async()=>({id:hex(16)}),delete:async()=>{}}:null};
window.stay={sb:{},getSession:async()=>({access_token:"t"}),showLogin(){},blobUrl:id=>"/_blob/"+id};
}else{
// ---------- modelo v2: banco falso com as TABELAS do v2.sql, e o backend.js de verdade por cima ----------
// O backend.js (adaptador v2) e o v2-codec.js reais são carregados aqui, antes da página, pra a
// suíte inteira rodar no caminho real: app -> adaptador -> tabelas. window.__store continua mostrando
// os documentos do app (tradução pelo codec), então os testes não mudam.
const carregar=u=>{const x=new XMLHttpRequest();x.open("GET",u,false);x.send();return x.responseText};
new Function(carregar("/v2-codec.js?real=1")).call(window);
const C=window.StayV2, DONO="11111111-1111-1111-1111-111111111111";
const T={}; C.TABELAS.forEach(t=>T[t]=new Map());
const docsSeed=[]; for(const c in seed)for(const [id,d] of Object.entries(seed[c]))docsSeed.push({col:c,id,data:d});
const seedT=C.mapear(docsSeed).tabelas; for(const t in seedT)seedT[t].forEach(r=>T[t].set(C.pkVal(t,r),{...r,owner:DONO}));
const canais=[];
const chamar=(tab,tipo,row)=>setTimeout(()=>canais.forEach(c=>c.hs.forEach(h=>{if(h.tabela===tab)h.cb({eventType:tipo,new:tipo==="DELETE"?null:row,old:tipo==="DELETE"?row:null})})),0);
function aplicar(p){
  (p.up||[]).forEach(([tab,rows])=>rows.forEach(r=>{const k=C.pkVal(tab,r),cur=T[tab].get(k),novo={...(cur||{}),...r,owner:DONO};T[tab].set(k,novo);chamar(tab,cur?"UPDATE":"INSERT",novo)}));
  (p.del||[]).forEach(([tab,rows])=>rows.forEach(r=>{const k=C.pkVal(tab,r),cur=T[tab].get(k);if(cur){T[tab].delete(k);chamar(tab,"DELETE",cur)}}));
}
window.__aplicados=[];
const sbFalso={
  auth:{getSession:async()=>({data:{session:{access_token:"t"}}}),signInWithOAuth:async()=>({})},
  from:tab=>({select(){return{range:async(a,b)=>({data:[...T[tab].values()].slice(a,b+1),error:null})}}}),
  rpc:async(nome,args)=>{if(nome!=="v2_aplicar")return{error:{message:"rpc desconhecida"}};window.__aplicados.push(args.p);try{aplicar(args.p)}catch(e){return{error:{message:e.message}}}return{error:null}},
  channel:()=>{const ch={hs:[],on(_,f,cb){ch.hs.push({tabela:f.table,cb});return ch},subscribe(){canais.push(ch);return ch}};return ch},
  storage:{from:()=>({upload:async()=>({error:null}),remove:async()=>({error:null}),getPublicUrl:id=>({data:{publicUrl:"/_blob/"+id}})})},
};
window.supabase={createClient:()=>sbFalso};
// config.js real roda depois e trocaria isto: fixa a configuração do teste
Object.defineProperty(window,"STAY_CONFIG",{value:{dataModel:"v2",supabaseUrl:"https://falso.supabase.co",supabaseAnonKey:"x"},writable:false,configurable:true});
new Function(carregar("/backend.js?real=1")).call(window);
// a visão dos documentos, no formato que os testes já usam (get/set/delete/values/size)
const pacote=r=>({up:Object.entries(r.up||{}),del:Object.entries(r.del||{})});
const docsDe=c=>C.paraDocs(T,[c])[c]||new Map();
const visao=c=>({get size(){return docsDe(c).size},get:id=>docsDe(c).get(id)||(c==="colecao"?{s:{}}:undefined),has:id=>docsDe(c).has(id),values:()=>docsDe(c).values(),keys:()=>docsDe(c).keys(),entries:()=>docsDe(c).entries(),[Symbol.iterator]:()=>docsDe(c).entries(),
  set(id,d){aplicar(pacote(C.escrever(c,id,d,T)));return this},delete(id){aplicar(pacote(C.apagarDoc(c,id,T)));return true}});
window.__store=new Proxy({},{get:(_,c)=>typeof c==="string"?visao(c):undefined});
window.__fire=()=>{};window.__tabelas=T;
}
})();