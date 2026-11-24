(function(){
const hex=n=>[...crypto.getRandomValues(new Uint8Array(n))].map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,n);
const seed={
 comunidades:{c1:{nome:"Comunidade Azul",goms:"Gabi e Duda"},c2:{nome:"Outra",goms:"Ana"}},
 cegs:{g1:{nome:"Caixa 2 PHP",comunidade:"Comunidade Azul",gom:"Gabi"},g2:{nome:"Variados 7",comunidade:"Comunidade Azul",gom:"Gabi"},g3:{nome:"Set Seung",comunidade:"Outra",gom:"Ana"}},
 itens:{i1:{item:"Han Aladin",membro:"HAN",ceg:"Caixa 2 PHP",comunidade:"Comunidade Azul",status:"Garantido"},i2:{item:"Felix LD",membro:"Felix",ceg:"Caixa 2 PHP",comunidade:"Comunidade Azul",status:"Com a GOM no Brasil",etiquetas:"troca"},i3:{item:"Seung set",membro:"Seungmin",ceg:"Set Seung",comunidade:"Outra",status:"Envio liberado"},i4:{item:"Chan pob",membro:"Bang Chan",ceg:"Variados 7",comunidade:"Comunidade Azul",status:"Recebido"}},
 cobrancas:{k1:{referente:"frete",ceg:"Caixa 2 PHP",comunidade:"Comunidade Azul",valor:18.4,status:"Pendente",prazo:"2026-12-01"}},
 fotos:{},colecao:{},cardsnovos:{},cegs2:{}
};
const store={}; const subs={};
for(const c in seed){store[c]=new Map(Object.entries(seed[c]).map(([k,v])=>[k,JSON.parse(JSON.stringify(v))]));subs[c]=new Set()}
const fire=c=>{(subs[c]||[]).forEach(f=>f())};
const snap=c=>({docs:[...(store[c]||new Map())].map(([id,d])=>({id,data:()=>d}))});
window.__store=store;
const db={
 collection:c=>{store[c]=store[c]||new Map();subs[c]=subs[c]||new Set();return{limit(){return this},onSnapshot(cb){const f=()=>cb(snap(c));subs[c].add(f);setTimeout(f,0);return()=>subs[c].delete(f)},async add(d){const id=hex(10);store[c].set(id,d);fire(c);return{id}}}},
 doc:p=>{const i=p.indexOf("/"),c=p.slice(0,i),id=p.slice(i+1);store[c]=store[c]||new Map();return{async set(d){store[c].set(id,d);fire(c)},async update(pt){store[c].set(id,{...store[c].get(id),...pt});fire(c)},async delete(){store[c].delete(id);fire(c)}}}
};
window.claude={use:async n=>n==="db"?db:n==="user"?{can:async()=>true}:n==="assets"?{upload:async()=>({id:hex(16)}),delete:async()=>{}}:null};
window.stay={sb:{},getSession:async()=>({access_token:"t"}),showLogin(){},blobUrl:id=>"/_blob/"+id};
})();
