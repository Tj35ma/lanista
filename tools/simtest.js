const G = require('./load.js');
const rng = new G.Rng(42);
function team(defs){ return defs.map((d,i)=>({g:G.makeFoe(d,i,0), c:d.c, r:d.r})); }
function pl(defs){ return defs.map((d,i)=>{const g=G.makeFoe(d,i+50,7); g.foe=false; return {g, c:d.c, r:d.r};}); }
// trận mẫu: 2 nô lệ rẻ với vũ khí cấp 1 đấu từng trận hạng Chợ
const mine = [G.e('A','bal',1,'gladius1',['s_plank'],0,1), G.e('B','big',1,'mace1',[],0,3)];
for (let t=0;t<4;t++) for (let s=0;s<7;s++){
  const d = G.CAMPAIGN[t][s]; let w=0, tt=0, n=200;
  const lv = G.TIERS[t].lvl + Math.floor(s/2.5);
  const kinds=['gladius','mace','hasta','sica','javelin'];
  const my=[]; for(let i=0;i<G.TIERS[t].field;i++){ const k=kinds[i%kinds.length]; const two=G.WKIND[k].hands===2;
    my.push(G.e('P'+i, ['bal','big','bal','agi','bal'][i], lv, k+(t+1), [ (!two&&i<2)?['s_plank','s_parma','s_hoplon','s_scutum'][t]:null, ['b_harness','b_leather','b_linen','b_hamata'][t], t>0?['h_cap','h_legion','h_legion','h_murmillo'][t]:null].filter(Boolean), k==='javelin'?2:(k==='hasta'?1:0), [2,1,3,0,4][i])); }
  for (let i=0;i<n;i++){ const b=G.runBattle(pl(my), team(d.foes), {seed:i*31+7}); if(b.winner===0) w++; tt+=b.time; }
  console.log(`T${t+1}.${s+1} ${d.name.padEnd(34)} lvl${lv} win ${(w/n*100).toFixed(0).padStart(3)}%  time ${(tt/n).toFixed(1)}s`);
}
