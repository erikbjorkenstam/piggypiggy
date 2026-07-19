/* PiggyPiggy Adventure — gemensam spelmotor.
   Används av banbyggaren.html (▶ Testa + export), piggypiggy_spel.html (äventyret)
   och exporterade spel. EN källa — ändra bara här.

   runGame(canvas, level, ASSETS, opts)
     level : ban-JSON (se PROJEKT.md). Kan innehålla "theme".
     opts  : { theme:'green'|'desert', move:Number, title:[{t,s,y,c},...] }
       theme  – bakgrund/dekor/fiendeutseende (standard 'green').
       move   – gånghastighet (standard 3.6; äventyret använder 4.0).
       title  – om satt visas en titelskärm innan spelet startar.
*/
window.runGame=function(canvas, level, ASSETS, opts){
  opts=opts||{};
  const ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const VW=canvas.width, VH=canvas.height;
  const IMG={}; let loaded=0; const ks=Object.keys(ASSETS);
  const GRAV=0.7, MOVE=opts.move||3.6, JUMPV=-14.5, MAXFALL=16;
  const groundTop = level.groundY||410;
  const LEVELW = level.width||5000;

  // ---- tema ----
  const THEMES={
    green:{ id:'green', desert:false,
      hudText:'#2b2440', hudPanel:'rgba(20,12,40,.5)', overlay:'rgba(20,12,40,.55)',
      vign:'rgba(16,20,34,0.38)', shadow:'#0e1220',
      platTop:'#6bbf59', platBody:'#8a5a2b', platDot:'#7a4d24',
      cloudBelly:'rgba(203,232,250,.55)', enemyBody:'#5b3b8c', dust:'#a8c69a', fg:'rgba(24,52,28,.42)' },
    desert:{ id:'desert', desert:true,
      hudText:'#3a2410', hudPanel:'rgba(40,20,10,.5)', overlay:'rgba(40,20,10,.55)',
      vign:'rgba(30,16,10,0.40)', shadow:'#1a0e08',
      platTop:'#e8c579', platBody:'#c99a5b', platDot:'#b6884a',
      cloudBelly:'rgba(240,228,190,.5)', enemyBody:'#5b3b8c', dust:'#e6c88a', fg:'rgba(90,60,24,.30)' },
    ice:{ id:'ice', desert:false,
      hudText:'#173042', hudPanel:'rgba(10,25,45,.5)', overlay:'rgba(10,25,45,.55)',
      vign:'rgba(10,20,40,0.40)', shadow:'#0a1626',
      platTop:'#eef8ff', platBody:'#6fa9cf', platDot:'#588fb5',
      cloudBelly:'rgba(210,235,250,.6)', enemyBody:'#4f86c9', dust:'#e8f4fb', fg:'rgba(150,190,220,.35)' }
  };
  const T=THEMES[opts.theme||level.theme]||THEMES.green;

  // ---- förrenderade texturer (billiga per frame: pattern-fills, inga filter) ----
  function texCanvas(w,h,fn){ const c=document.createElement('canvas'); c.width=w; c.height=h;
    const g=c.getContext('2d'); fn(g,w,h); return c; }
  function rnd(seed){ let s=seed|0; return ()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; }; }
  // markens "kropp" — jord/sandsten/is
  const GROUND_TEX=texCanvas(64,64,(g,w,h)=>{ const R=rnd(7);
    if(T.id==='desert'){ g.fillStyle='#c99a5b'; g.fillRect(0,0,w,h);
      for(let i=0;i<90;i++){ g.fillStyle=R()<0.5?'#bf8f4e':'#d3a768'; g.fillRect((R()*w)|0,(R()*h)|0,2,2); }
      g.fillStyle='rgba(120,80,35,.35)'; for(let y=10;y<h;y+=16){ for(let x=0;x<w;x+=20){ g.fillRect(x+((y/16)%2)*10,y,16,1); } }
      g.fillStyle='#b6884a'; for(let i=0;i<6;i++){ g.fillRect((R()*w)|0,(R()*h)|0,4,2); }
    } else if(T.id==='ice'){ g.fillStyle='#6fa9cf'; g.fillRect(0,0,w,h);
      for(let i=0;i<70;i++){ g.fillStyle=R()<0.5?'#639ec6':'#7cb4d8'; g.fillRect((R()*w)|0,(R()*h)|0,2,2); }
      g.strokeStyle='rgba(230,246,255,.35)'; g.lineWidth=1.5;
      for(let i=0;i<4;i++){ const x0=R()*w,y0=R()*h; g.beginPath(); g.moveTo(x0,y0);
        g.lineTo(x0+8+R()*10,y0+6+R()*8); g.lineTo(x0+14+R()*12,y0+2+R()*14); g.stroke(); }
      g.fillStyle='rgba(255,255,255,.5)'; for(let i=0;i<8;i++)g.fillRect((R()*w)|0,(R()*h)|0,2,2);
    } else { g.fillStyle='#8a5a2b'; g.fillRect(0,0,w,h);
      for(let i=0;i<90;i++){ g.fillStyle=R()<0.5?'#7d5026':'#966534'; g.fillRect((R()*w)|0,(R()*h)|0,2,2); }
      for(let i=0;i<7;i++){ const sx=(R()*w)|0, sy=(R()*h)|0, sw=4+R()*5;
        g.fillStyle='#6e6259'; g.beginPath(); g.ellipse(sx,sy,sw,sw*0.7,0,0,7); g.fill();
        g.fillStyle='#8a8078'; g.beginPath(); g.ellipse(sx-1,sy-1,sw*0.45,sw*0.32,0,0,7); g.fill(); }
      g.strokeStyle='rgba(90,55,25,.5)'; g.lineWidth=1.5;
      for(let i=0;i<3;i++){ const x0=R()*w; g.beginPath(); g.moveTo(x0,R()*h);
        g.quadraticCurveTo(x0+6,R()*h,x0+3,R()*h); g.stroke(); } } });
  // avsatsernas kropp — samma familj, lite ljusare
  const LEDGE_TEX=texCanvas(48,48,(g,w,h)=>{ const R=rnd(21);
    if(T.id==='desert'){ g.fillStyle='#d0a262'; g.fillRect(0,0,w,h);
      for(let i=0;i<50;i++){ g.fillStyle=R()<0.5?'#c49453':'#dcb074'; g.fillRect((R()*w)|0,(R()*h)|0,2,2); }
    } else if(T.id==='ice'){ g.fillStyle='#7cb4d8'; g.fillRect(0,0,w,h);
      for(let i=0;i<40;i++){ g.fillStyle=R()<0.5?'#6fa9cf':'#8ec2e0'; g.fillRect((R()*w)|0,(R()*h)|0,2,2); }
      g.fillStyle='rgba(255,255,255,.45)'; for(let i=0;i<5;i++)g.fillRect((R()*w)|0,(R()*h)|0,2,2);
    } else { g.fillStyle='#96662f'; g.fillRect(0,0,w,h);
      for(let i=0;i<50;i++){ g.fillStyle=R()<0.5?'#88592a':'#a37238'; g.fillRect((R()*w)|0,(R()*h)|0,2,2); } } });
  const GROUND_PAT=ctx.createPattern(GROUND_TEX,'repeat');
  const LEDGE_PAT=ctx.createPattern(LEDGE_TEX,'repeat');
  // förrenderat mynt (roterar via scaleX i drawCoin)
  const COIN_TEX=texCanvas(26,26,(g)=>{ g.translate(13,13);
    g.fillStyle='#caa72f'; g.beginPath(); g.arc(0,1.5,10,0,7); g.fill();
    g.fillStyle='#f4d64a'; g.beginPath(); g.arc(0,0,10,0,7); g.fill();
    g.fillStyle='#caa72f'; g.beginPath(); g.arc(0,0,6.5,0,7); g.fill();
    g.fillStyle='#e8c33e'; g.beginPath(); g.arc(0,0,5,0,7); g.fill();
    g.fillStyle='#fff3b0'; g.beginPath(); g.arc(-3.5,-3.5,2.2,0,7); g.fill();
    g.fillStyle='#f4d64a'; g.font='bold 8px system-ui'; g.textAlign='center'; g.textBaseline='middle';
    g.fillStyle='#a8861f'; g.fillRect(-1,-3,2,6); g.fillRect(-3,-1,6,2); });

  // ---- affärer & plånbok ----
  // Mynten (wallet) och köpta färdigheter (perks) ligger UTANFÖR reset()
  // och överlever alltså döden/omstart. Med opts.saveKey sparas de i localStorage.
  const SHOP_W=64, SHOP_H=70;
  const shops=(level.shops||[]).map(s=>({x:s.x,y:s.y||groundTop}));
  const ITEMS=[
    {id:'heart', name:'Extra hj\u00e4rta', desc:'+1 liv (max 5) f\u00f6r det h\u00e4r f\u00f6rs\u00f6ket', price:800},
    {id:'shield',name:'Sk\u00f6ld',          desc:'T\u00e5l en tr\u00e4ff fr\u00e5n fiender, is eller boss', price:500},
    {id:'jump',  name:'Superhopp',      desc:'Hoppa h\u00f6gre \u2014 f\u00f6r alltid', price:1000, perk:true},
    {id:'shoes', name:'Snabba skor',    desc:'Spring fortare \u2014 f\u00f6r alltid', price:1000, perk:true},
    {id:'ice',   name:'Is-skydd',       desc:'IsIs is-projektiler skadar inte', price:1200, perk:true}
  ];
  let wallet=0, perks={}, gear={shield:false}, shopCooldown=0, shopReturn='play', shopHits=[], titleShopRect=null;
  if(opts.saveKey){ try{ const s=JSON.parse(localStorage.getItem(opts.saveKey)||'{}');
    wallet=s.wallet|0; perks=s.perks||{}; gear=s.gear||{shield:false}; }catch(e){} }
  function saveState(){ if(!opts.saveKey)return; try{ localStorage.setItem(opts.saveKey,JSON.stringify({wallet:wallet,perks:perks,gear:gear,hero:chosenHero})); }catch(e){} }
  function moveSpd(){ return MOVE*(perks.shoes?1.18:1)*CHARS[hero].move; }
  function jumpV(){ return JUMPV*(perks.jump?1.12:1)*CHARS[hero].jump; }

  // ---- spelbara hjältar ----
  // PiggyPiggy: +1 hjärta. LiggyLiggy: snabbare. ZiggyZiggy: hoppar högre.
  // Räddade kompisar tar över när hjälten förlorar alla hjärtan (= extraliv).
  const CHARS={
    piggy:{name:'PiggyPiggy',hearts:4,move:1,jump:1,h:60,idle:'piggy',walk:['piggyA','piggyB'],skill:'+1 hj\u00e4rta'},
    liggy:{name:'LiggyLiggy',hearts:3,move:1.15,jump:1,h:66,idle:'liggy',walk:['liggy','liggyB'],skill:'Snabbare'},
    ziggy:{name:'ZiggyZiggy',hearts:3,move:1,jump:1.09,h:60,idle:'ziggy',walk:['ziggy','ziggy'],skill:'Hoppar h\u00f6gre'}
  };
  let chosenHero='piggy', hero='piggy', charRects=[];
  if(opts.saveKey){ try{ const s=JSON.parse(localStorage.getItem(opts.saveKey)||'{}');
    if(CHARS[s.hero])chosenHero=hero=s.hero; }catch(e){} }

  // ---- banans geometri ----
  const groundSolids=[], oneways=[];
  (level.grounds||[]).forEach(g=>groundSolids.push({x:g.x,y:g.y,w:g.w,h:g.h,ground:true}));
  (level.ledges||[]).forEach(g=>oneways.push({x:g.x,y:g.y,w:g.w,h:g.h,ground:false,crumble:!!g.crumble,phase:0,ct:0,fallV:0,yOff:0}));
  const movers=(level.movers||[]).map(m=>({x:m.x,y0:m.y,y:m.y,w:m.w,h:m.h||18,dy:(m.dy!=null?m.dy:-140),mt:0,dv:0,carry:false,mover:true,ground:false,crumble:false,phase:0,ct:0,fallV:0,yOff:0}));
  movers.forEach(m=>oneways.push(m));
  const plats=groundSolids.concat(oneways);
  const bouncers=(level.bouncers||[]).map(b=>({x:b.x,w:46,anim:0,t:Math.random()*6}));
  const walls=[{x:-60,y:-1000,w:60,h:3000}];

  let coins,friends,enemies,boss,player,cam,state,msg,msgT,frame=0,checkpoints,iceShots,trail,rescueN,parts,shake,flags;
  let friendsTotal=0;
  function friendKey(base){ return base===hero?'piggy':base; }
  function reset(){
    hero=chosenHero;
    coins=(level.coins||[]).map(c=>({x:c.x,y:c.y,r:9,got:false,t:Math.random()*6}));
    friends=(level.friends||[]).map(f=>{ const k=friendKey(f.key);
      return {key:k,baseKey:f.key,x:f.x,y:f.y,w:48,h:56,drawH:k==='liggy'?66:60,got:false,playing:false,bob:Math.random()*6,name:f.name||CHARS[k].name}; });
    enemies=(level.enemies||[]).map(e=>({x:e.x,y:(e.y||groundTop)-30,w:34,h:30,dir:-1,lo:e.lo!=null?e.lo:e.x-110,hi:e.hi!=null?e.hi:e.x+110,alive:true,t:Math.random()*8,squish:1,glow:Math.random()*6}));
    boss=level.boss? {x:level.boss.x,y:(level.boss.y||160),w:78,h:70,hp:3,inv:0,flap:0,t:0,dead:false,hitFlash:0,homeX:level.boss.x,hoverY:(level.boss.y||160),state:'hover',stateT:100,vy:0,shootT:70,hintShown:false}:null;
    iceShots=[];
    const st=level.start||{x:70,y:300};
    player={x:st.x,y:st.y,w:38,h:52,vx:0,vy:0,onGround:false,face:1,hearts:CHARS[hero].hearts,inv:0,anim:0,rescued:0,stretch:1};
    cam=0; state='play'; msg=''; msgT=0; trail=[]; rescueN=0; parts=[]; shake=0;
    for(const pl of oneways){ if(pl.crumble){pl.phase=0;pl.ct=0;pl.fallV=0;pl.yOff=0;} }
    for(const m of movers){ m.y=m.y0; m.mt=0; m.carry=false; m.dv=0; }
    for(const b of bouncers)b.anim=0;
    checkpoints=[st.x];
    (level.grounds||[]).forEach(g=>{ checkpoints.push(g.x+8); });
    checkpoints.sort((a,b)=>a-b);
    flags=checkpoints.filter(c=>c>st.x+40).map(cx=>({x:cx,passed:false}));
    friendsTotal=friends.length;
  }

  // ---- input ----
  const input={left:false,right:false,jump:false,edge:false};
  function jset(v){ if(v&&!input.jump)input.edge=true; input.jump=v; }
  function kd(e){
    if(state==='shop'){ if(e.code==='Escape'||e.code==='Enter'||e.code==='Space')closeShop();
      else if(/^Digit[1-5]$/.test(e.code))buy(+e.code.slice(5)-1);
      e.preventDefault(); return; }
    if(['ArrowLeft','KeyA'].includes(e.code))input.left=true;
    if(['ArrowRight','KeyD'].includes(e.code))input.right=true;
    if(['ArrowUp','Space','KeyW','KeyZ'].includes(e.code)){jset(true);e.preventDefault();}
    if((e.code==='Enter'||e.code==='Space')&&state!=='play'){ if(state==='title')state='play'; else reset(); } }
  function ku(e){ if(['ArrowLeft','KeyA'].includes(e.code))input.left=false;
    if(['ArrowRight','KeyD'].includes(e.code))input.right=false;
    if(['ArrowUp','Space','KeyW','KeyZ'].includes(e.code))jset(false); }
  addEventListener('keydown',kd); addEventListener('keyup',ku);
  const btns=[];
  function bind(id,fn){const el=document.getElementById(id); if(!el)return;
    const d=e=>{e.preventDefault();fn(true);}, u=e=>{e.preventDefault();fn(false);};
    el.addEventListener('pointerdown',d); el.addEventListener('pointerup',u);
    el.addEventListener('pointerleave',u); el.addEventListener('pointercancel',u);
    btns.push([el,d,u]);}
  bind('gLeft',v=>input.left=v); bind('gRight',v=>input.right=v);
  bind('gJump',v=>{ if(v&&state==='shop'){closeShop();return;} jset(v);
    if(v&&state!=='play'){ if(state==='title')state='play'; else reset(); }});
  function canvasTap(e){ const r=canvas.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width*VW, y=(e.clientY-r.top)/r.height*VH;
    if(state==='shop'){ for(const h of shopHits){ if(x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h){ if(h.buy!=null)buy(h.buy); else closeShop(); return; } } return; }
    if(state==='title'){
      for(const c of charRects){ if(x>=c.x&&x<=c.x+c.w&&y>=c.y&&y<=c.y+c.h){
        chosenHero=hero=c.key; player.hearts=CHARS[hero].hearts;
        friends.forEach(f=>{ if(!f.got){ f.key=friendKey(f.baseKey); f.drawH=f.key==='liggy'?66:60; f.name=CHARS[f.key].name; } });
        saveState(); beep(700,0.07,'triangle',0.05); return; } }
      if(titleShopRect&&x>=titleShopRect.x&&x<=titleShopRect.x+titleShopRect.w&&y>=titleShopRect.y&&y<=titleShopRect.y+titleShopRect.h){ openShop('title'); } else state='play'; return; }
    if(state!=='play')reset(); }
  canvas.addEventListener('pointerdown',canvasTap);

  // ---- ljud ----
  let AC=null;
  function beep(f,d,t,v){try{if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();
    const o=AC.createOscillator(),g=AC.createGain();o.type=t||'square';o.frequency.value=f;g.gain.value=v||0.05;
    o.connect(g);g.connect(AC.destination);o.start();g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+(d||0.1));o.stop(AC.currentTime+(d||0.1));}catch(e){}}

  // ---- fysik ----
  function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function physics(p){
    // horisontellt: väggar + solida markblock (sidorna stoppar)
    p.x+=p.vx;
    const hs=walls.concat(groundSolids);
    let hb={x:p.x,y:p.y,w:p.w,h:p.h};
    for(const s of hs){ if(overlap(hb,s)){ if(p.vx>0)p.x=s.x-p.w; else if(p.vx<0)p.x=s.x+s.w; p.vx=0; hb.x=p.x; } }
    if(p.x<0)p.x=0; if(p.x>LEVELW-p.w)p.x=LEVELW-p.w;
    // vertikalt
    p.vy+=GRAV; if(p.vy>MAXFALL)p.vy=MAXFALL;
    const prev=p.y+p.h; p.y+=p.vy; p.onGround=false;
    let vb={x:p.x,y:p.y,w:p.w,h:p.h};
    for(const s of groundSolids){ if(overlap(vb,s)){
      if(p.vy>0){p.y=s.y-p.h;p.vy=0;p.onGround=true;} else if(p.vy<0){p.y=s.y+s.h;p.vy=0;} vb.y=p.y; } }
    for(const pl of oneways){ if(pl.phase>=2)continue; const py=pl.y+pl.yOff;
      if(p.x+p.w>pl.x+4&&p.x<pl.x+pl.w-4){
      if(p.vy>=0&&prev<=py+2&&p.y+p.h>=py){p.y=py-p.h;p.vy=0;p.onGround=true;vb.y=p.y;
        if(pl.crumble&&pl.phase===0){pl.phase=1;pl.ct=40;}
        if(pl.mover)pl.carry=true;} } }
  }

  // ---- is-projektiler ----
  function shootIce(){ const p=player,bx=boss.x,by=boss.y+boss.h*0.45;
    const dx=(p.x+p.w/2)-bx,dy=(p.y+p.h*0.5)-by,d=Math.hypot(dx,dy)||1,spd=3.4;
    iceShots.push({x:bx,y:by,vx:dx/d*spd,vy:dy/d*spd-0.9,r:9,t:0,dead:false}); beep(720,0.08,'triangle',0.04); }
  function drawIce(s){ const x=s.x-cam,y=s.y; ctx.save();ctx.translate(x,y);ctx.rotate(s.t*0.18);
    ctx.fillStyle='#8fd8e8';ctx.strokeStyle='#2a2830';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,-s.r);ctx.lineTo(s.r*0.72,0);ctx.lineTo(0,s.r);ctx.lineTo(-s.r*0.72,0);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#eafcff';ctx.fillRect(-2,-3,3,3);ctx.restore(); }

  function hurt(pit){ const p=player; if(!pit&&p.inv>0)return;
    if(!pit&&gear.shield){ gear.shield=false; saveState(); p.inv=90;
      showMsg('Sk\u00f6lden r\u00e4ddade dig!'); beep(500,0.15,'triangle',0.06);
      p.vx=-p.face*5; p.vy=-6; return; }
    p.hearts--; beep(180,0.2,'sawtooth',0.06);
    if(p.hearts<=0){
      const sub=friends.find(f=>f.got&&!f.playing);
      if(sub){ sub.playing=true; hero=sub.key;
        p.hearts=CHARS[hero].hearts; p.inv=120; p.vx=0; p.vy=-6;
        if(pit){ let cp=checkpoints[0]; for(const c of checkpoints) if(p.x>c)cp=c;
          p.x=cp; p.y=groundTop-120; p.vy=0; trail.length=0; }
        showMsg(sub.name+' tar \u00f6ver!');
        beep(520,0.1,'square',0.05); beep(700,0.12,'square',0.05);
        return; }
      state='lose'; report(false); return; }
    p.inv=90;
    if(pit){ let cp=checkpoints[0]; for(const c of checkpoints) if(p.x>c)cp=c; p.x=cp;p.y=groundTop-120;p.vx=0;p.vy=0; trail.length=0; }
    else {p.vx=-p.face*5;p.vy=-6;} }
  function report(won){ if(!opts.onEnd)return; try{ opts.onEnd({won:won,
    rescued:player.rescued, friendsTotal:friendsTotal,
    coinsGot:coins.filter(c=>c.got).length, coinsTotal:coins.length,
    allCoins:coins.length>0&&coins.every(c=>c.got), wallet:wallet}); }catch(e){} }
  function win(){state='win';report(true);beep(660,0.15,'square',0.06);setTimeout(()=>beep(880,0.2,'square',0.06),150);setTimeout(()=>beep(1180,0.3,'square',0.06),330);}
  function showMsg(t){msg=t;msgT=140;}
  function puff(x,y,n,col,spread,speed,g){ for(let i=0;i<n;i++){ const a=Math.random()*6.28, sp=(0.4+Math.random())*(speed||2);
    parts.push({x:x+(Math.random()-0.5)*(spread||3)*2,y:y+(Math.random()-0.5)*3,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-0.6,
      life:18+Math.random()*14,max:32,col:col,g:g!=null?g:0.05}); } }
  function openShop(from){ shopReturn=from; state='shop'; shopHits=[]; beep(660,0.08,'triangle',0.05); beep(880,0.08,'triangle',0.04); }
  function closeShop(){ if(shopReturn==='title'){ state='title'; } else { state='play'; shopCooldown=130; } }
  function canBuy(it){ if(it.perk&&perks[it.id])return 'K\u00d6PT \u2713';
    if(it.id==='shield'&&gear.shield)return 'AKTIV';
    if(it.id==='heart'&&player.hearts>=5)return 'MAX';
    return null; }
  function buy(i){ const it=ITEMS[i]; if(!it)return;
    if(canBuy(it)||wallet<it.price){ beep(200,0.12,'sawtooth',0.05); return; }
    wallet-=it.price;
    if(it.perk)perks[it.id]=true;
    else if(it.id==='heart')player.hearts=Math.min(5,player.hearts+1);
    else if(it.id==='shield')gear.shield=true;
    saveState(); beep(880,0.08,'triangle',0.05); beep(1180,0.1,'triangle',0.05); }

  // ---- uppdatering ----
  function update(){
    frame++; if(state!=='play')return;
    const p=player;
    if(input.left){p.vx=-moveSpd();p.face=-1;} else if(input.right){p.vx=moveSpd();p.face=1;} else p.vx*=0.6;
    if(input.edge&&p.onGround){p.vy=jumpV();p.onGround=false;p.stretch=1.22;beep(520,0.12,'square',0.05);} input.edge=false;
    for(const m of movers){ const mprev=m.y; m.mt+=0.02; m.y=m.y0+m.dy*(0.5-0.5*Math.cos(m.mt)); m.dv=m.y-mprev;
      if(m.carry)p.y+=m.dv; m.carry=false; }
    const wasG=p.onGround, fallV=p.vy;
    physics(p); if(p.inv>0)p.inv--; if(shopCooldown>0)shopCooldown--;
    if(!wasG&&p.onGround&&fallV>7){ p.stretch=0.78; puff(p.x+p.w/2,p.y+p.h,8,T.dust,6,1.6,0.04); }
    p.stretch+=(1-p.stretch)*0.15;
    for(const q of parts){ q.life--; q.x+=q.vx; q.y+=q.vy; q.vy+=q.g; }
    parts=parts.filter(q=>q.life>0);
    if(shake>0)shake--;
    trail.push({x:p.x,y:p.y+p.h,face:p.face,moving:Math.abs(p.vx)>0.5&&p.onGround});
    if(trail.length>400)trail.shift();
    for(const fl of flags){ if(!fl.passed&&p.x>fl.x-10){fl.passed=true;
      puff(fl.x,groundTop-58,12,'#f4d64a',3,2,0.03);beep(880,0.09,'triangle',0.05);beep(1320,0.12,'triangle',0.05);} }
    if(Math.abs(p.vx)>0.5&&p.onGround)p.anim+=0.25; else p.anim=0;
    if(p.y>VH+140)hurt(true);
    for(const c of coins){ if(!c.got){c.t+=0.1;
      if(Math.abs((p.x+p.w/2)-c.x)<26&&Math.abs((p.y+p.h/2)-c.y)<30){c.got=true;wallet++;saveState();puff(c.x,c.y,8,'#f4d64a',3,2);beep(880,0.08,'triangle',0.05);beep(1180,0.08,'triangle',0.04);}}}
    for(const s of shops){ if(shopCooldown<=0&&!p.onGround&&Math.abs(p.vx)<0.8&&overlap({x:p.x,y:p.y,w:p.w,h:p.h},{x:s.x-SHOP_W/2,y:s.y-SHOP_H,w:SHOP_W,h:SHOP_H})){ openShop('play'); return; } }
    for(const b of bouncers){ b.t+=0.08; if(b.anim>0)b.anim--;
      if(p.vy>=0&&p.x+p.w>b.x-b.w/2&&p.x<b.x+b.w/2&&p.y+p.h>=groundTop-18&&p.y+p.h<=groundTop+6){
        p.vy=-20; p.onGround=false; b.anim=14; p.stretch=1.45; puff(b.x,groundTop-10,14,'#ffd24a',4,3);
        beep(340,0.1,'square',0.06); beep(620,0.12,'square',0.05); } }
    for(const pl of oneways){ if(!pl.crumble)continue;
      if(pl.phase===1){ pl.ct--; if(pl.ct<=0){pl.phase=2;pl.fallV=0;puff(pl.x+pl.w/2,pl.y+8,10,T.platBody,3,1.5);} }
      else if(pl.phase===2){ pl.fallV+=0.5; pl.yOff+=pl.fallV; if(pl.yOff>340){pl.phase=3;pl.ct=190;} }
      else if(pl.phase===3){ pl.ct--; if(pl.ct<=0){pl.phase=0;pl.yOff=0;pl.fallV=0;puff(pl.x+pl.w/2,pl.y,8,'#ffe9c0',3,1.2,0.02);} } }
    for(const f of friends){ if(!f.got){f.bob+=0.06;
      const fb={x:f.x-f.w/2,y:f.y-f.h,w:f.w,h:f.h}, pb={x:p.x,y:p.y,w:p.w,h:p.h};
      if(overlap(pb,fb)){f.got=true;f.order=rescueN++;p.rescued++;puff(f.x,f.y-30,12,'#e39ab5',3,2,0.02);showMsg('Du räddade '+f.name+'!');beep(700,0.1,'square',0.05);beep(1050,0.12,'square',0.05);}}}
    for(const e of enemies){ if(!e.alive){e.squish*=0.8;continue;} e.t+=0.15; e.glow+=0.2; e.x+=e.dir*1.1;
      if(T.id==='desert'&&Math.random()<0.12)parts.push({x:e.x+(Math.random()-0.5)*e.w*0.7,y:e.y+6,vx:(Math.random()-0.5)*0.4,vy:-0.5-Math.random()*0.7,life:20+Math.random()*14,max:34,col:Math.random()<0.5?'#ffb03a':'#ff7a1a',g:-0.004});
      if(T.id==='ice'&&Math.random()<0.08)parts.push({x:e.x+(Math.random()-0.5)*e.w*0.7,y:e.y+8,vx:(Math.random()-0.5)*0.3,vy:-0.2-Math.random()*0.4,life:22,max:30,col:'#eafcff',g:-0.002});
      if(e.x<e.lo){e.x=e.lo;e.dir=1;} if(e.x>e.hi){e.x=e.hi;e.dir=-1;}
      const eb={x:e.x-e.w/2,y:e.y,w:e.w,h:e.h}, pb={x:p.x,y:p.y,w:p.w,h:p.h};
      if(overlap(pb,eb)){ if(p.vy>0&&(p.y+p.h)-e.y<22){e.alive=false;e.squish=1;p.vy=JUMPV*0.7;wallet++;saveState();puff(e.x,e.y+e.h/2,10,T.id==='desert'?'#ff8a3a':T.id==='ice'?'#bfe7f4':'#b89ae0',3,2);beep(300,0.12,'square',0.06);} else hurt(false);} }
    if(boss&&!boss.dead){
      boss.t+=0.04; boss.flap=(frame%14<7)?0:1;
      if(boss.inv>0)boss.inv--; if(boss.hitFlash>0)boss.hitFlash--; boss.stateT--;
      if(!boss.hintShown&&Math.abs(p.x-boss.homeX)<420){boss.hintShown=true;showMsg('Undvik isen — stampa när IsIs slår i marken!');}
      const arenaL=boss.homeX-280,arenaR=boss.homeX+220,slamY=groundTop-boss.h,hoverY=boss.hoverY;
      if(boss.state==='hover'){
        boss.y=hoverY+Math.sin(boss.t)*30;
        const tx=Math.max(arenaL,Math.min(arenaR,p.x)); boss.x+=Math.sign(tx-boss.x)*Math.min(1.4,Math.abs(tx-boss.x)*0.03);
        if(--boss.shootT<=0){shootIce();boss.shootT=(boss.hp>=3?120:boss.hp===2?90:64);}
        if(boss.stateT<=0){boss.state='telegraph';boss.stateT=44;}
      } else if(boss.state==='telegraph'){
        boss.y+=((hoverY-30)-boss.y)*0.1;
        const tx=Math.max(arenaL,Math.min(arenaR,p.x)); boss.x+=(tx-boss.x)*0.16;
        if(boss.stateT%8<4)boss.hitFlash=10;
        if(boss.stateT<=0){boss.state='dive';boss.vy=0;beep(150,0.15,'sawtooth',0.05);}
      } else if(boss.state==='dive'){
        boss.vy+=1.3; boss.y+=boss.vy;
        if(boss.y>=slamY){boss.y=slamY;boss.state='stunned';boss.stateT=80;shake=14;puff(boss.x,groundTop,16,T.dust,10,2.5,0.06);beep(90,0.25,'sawtooth',0.07);}
      } else if(boss.state==='stunned'){
        boss.y=slamY+Math.sin(frame*0.5)*1.5;
        if(boss.stateT<=0)boss.state='rise';
      } else {
        boss.y+=(hoverY-boss.y)*0.08;
        if(boss.y-hoverY<6){boss.state='hover';boss.stateT=140+((frame*7)%50);boss.shootT=30;}
      }
      boss.x=Math.max(arenaL,Math.min(arenaR,boss.x));
      const bb={x:boss.x-boss.w/2,y:boss.y,w:boss.w,h:boss.h}, pb={x:p.x,y:p.y,w:p.w,h:p.h};
      if(overlap(pb,bb)){
        if(p.vy>0&&(p.y+p.h)-boss.y<34&&boss.inv<=0&&(boss.state==='stunned'||boss.state==='dive')){
          boss.hp--;boss.inv=50;boss.hitFlash=30;p.vy=JUMPV*0.9;beep(220,0.2,'sawtooth',0.06);
          if(boss.hp<=0){boss.dead=true;win();} else {boss.state='rise';}
        } else if(boss.inv<=0&&boss.state!=='stunned') hurt(false);
      }
    }
    for(const s of iceShots){ s.t++; s.vy+=0.12; s.x+=s.vx; s.y+=s.vy;
      if(!s.dead&&overlap({x:p.x,y:p.y,w:p.w,h:p.h},{x:s.x-s.r,y:s.y-s.r,w:s.r*2,h:s.r*2})){s.dead=true;
        if(perks.ice){beep(1150,0.07,'triangle',0.04);} else {hurt(false);beep(200,0.12,'sawtooth',0.05);}}
      if(s.y>groundTop+8||s.x<cam-80||s.x>cam+VW+80)s.dead=true; }
    iceShots=iceShots.filter(s=>!s.dead);
    if(!boss && p.x>LEVELW-120) win();
    cam=Math.max(0,Math.min(Math.max(0,LEVELW-VW), p.x+p.w/2-VW/2));
    if(msgT>0)msgT--;
  }

  // ---- ritning ----
  function spr(img,cx,feetY,H,flip,flash){ const sc=H/img.height,w=img.width*sc;
    ctx.save();ctx.translate(cx,feetY-H); if(flip){ctx.translate(w,0);ctx.scale(-1,1);}
    ctx.drawImage(img,0,0,w,H);
    if(flash){ctx.globalCompositeOperation='source-atop';ctx.fillStyle='rgba(255,255,255,'+flash+')';ctx.fillRect(0,0,w,H);} ctx.restore(); }
  function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function cloud(cx,cy,s){ ctx.fillStyle='rgba(255,255,255,.94)';
    const lobes=[[0,2,26],[24,5,19],[-24,5,19],[12,-11,18],[-12,-11,18],[0,9,23]];
    ctx.beginPath(); for(const l of lobes)ctx.ellipse(cx+l[0]*s,cy+l[1]*s,l[2]*s,l[2]*s*0.82,0,0,7); ctx.fill();
    ctx.fillStyle=T.cloudBelly; ctx.beginPath(); ctx.ellipse(cx,cy+12*s,30*s,6*s,0,0,7); ctx.fill(); }

  function drawBG(){
    const g=ctx.createLinearGradient(0,0,0,VH);
    if(T.id==='desert'){ g.addColorStop(0,'#8ec9e8');g.addColorStop(0.6,'#dfe6c9');g.addColorStop(1,'#f0dca6'); }
    else if(T.id==='ice'){ g.addColorStop(0,'#8fb8de');g.addColorStop(0.55,'#c9e2f2');g.addColorStop(1,'#eaf5fb'); }
    else { g.addColorStop(0,'#8fd3f0');g.addColorStop(1,'#cdeefb'); }
    ctx.fillStyle=g;ctx.fillRect(0,0,VW,VH);
    if(T.id==='ice'){
      // blek vintersol
      const su=700-cam*0.03%VW;
      ctx.fillStyle='rgba(255,255,235,.30)';ctx.beginPath();ctx.arc(su,70,48,0,7);ctx.fill();
      ctx.fillStyle='rgba(255,255,245,.85)';ctx.beginPath();ctx.arc(su,70,26,0,7);ctx.fill();
      // norrsken — två mjuka band
      for(let b=0;b<2;b++){ ctx.strokeStyle=b?'rgba(140,200,255,.14)':'rgba(120,240,190,.16)';
        ctx.lineWidth=26-b*8; ctx.lineCap='round'; ctx.beginPath();
        for(let i=0;i<=8;i++){ const ax=i*(VW/8);
          const ay=60+b*34+Math.sin(frame*0.008+i*0.9+b*2-cam*0.0015)*22;
          i===0?ctx.moveTo(ax,ay):ctx.lineTo(ax,ay); }
        ctx.stroke(); }
      // berg med snötoppar
      for(let i=0;i<6;i++){const px=(i*720-cam*0.2)%(VW+720)-160, base=380, hw=170, h=190;
        ctx.fillStyle='#6f97bd';ctx.beginPath();ctx.moveTo(px,base);ctx.lineTo(px+hw,base-h);ctx.lineTo(px+hw*2,base);ctx.closePath();ctx.fill();
        ctx.fillStyle='#f2f8fd';ctx.beginPath();ctx.moveTo(px+hw*0.7,base-h*0.7);ctx.lineTo(px+hw,base-h);ctx.lineTo(px+hw*1.3,base-h*0.7);
        ctx.lineTo(px+hw*1.16,base-h*0.62);ctx.lineTo(px+hw,base-h*0.72);ctx.lineTo(px+hw*0.84,base-h*0.62);ctx.closePath();ctx.fill();}
      // moln
      const CW=VW+700, ct=frame*0.1;
      for(let i=0;i<4;i++){ const base=i*700+(i*211%150);
        const cx2=((base-cam*0.22-ct)%CW+CW)%CW-150, cy=56+(i%2)*38+Math.sin(frame*0.01+i)*3;
        cloud(cx2,cy,0.8+(i%2)*0.15); }
      // snödrivor
      ctx.fillStyle='#ddeefa';
      for(let i=0;i<8;i++){const hx=(i*600-cam*0.45)%(VW+600)-200;ctx.beginPath();ctx.arc(hx,475,200,Math.PI,0);ctx.fill();}
      ctx.fillStyle='#cbe2f4';
      for(let i=0;i<8;i++){const hx=(i*500+240-cam*0.6)%(VW+500)-200;ctx.beginPath();ctx.arc(hx,490,150,Math.PI,0);ctx.fill();}
      // fallande snö (tre parallaxdjup)
      ctx.fillStyle='rgba(255,255,255,.85)';
      for(let i=0;i<42;i++){ const d=1+(i%3), sp=0.35*d;
        const sx=((i*173+Math.sin((frame+i*37)*0.02)*30-cam*0.12*d)%VW+VW)%VW;
        const sy=(i*61+frame*sp)%VH;
        ctx.fillRect(sx,sy,d,d); }
    } else if(T.id==='desert'){
      // sol
      const sx=740-cam*0.05%VW;
      ctx.fillStyle='#fbe08a';ctx.beginPath();ctx.arc(sx,90,42,0,7);ctx.fill();
      ctx.fillStyle='rgba(251,224,138,.35)';ctx.beginPath();ctx.arc(sx,90,60,0,7);ctx.fill();
      // moln
      const CW=VW+700, ct=frame*0.14;
      for(let i=0;i<4;i++){ const base=i*720+(i*197%140);
        const cx2=((base-cam*0.2-ct)%CW+CW)%CW-150, cy=60+(i%2)*40+Math.sin(frame*0.011+i)*3;
        cloud(cx2,cy,0.85+(i%2)*0.15); }
      // pyramider
      ctx.fillStyle='#d8b174';
      for(let i=0;i<6;i++){const px=(i*760-cam*0.25)%(VW+760)-150, base=360, hw=150;
        ctx.beginPath();ctx.moveTo(px,base);ctx.lineTo(px+hw,base-150);ctx.lineTo(px+hw*2,base);ctx.closePath();ctx.fill();}
      ctx.fillStyle='#c99a5b';
      for(let i=0;i<6;i++){const px=(i*760-cam*0.25)%(VW+760)-150, base=360, hw=150;
        ctx.beginPath();ctx.moveTo(px+hw,base-150);ctx.lineTo(px+hw*2,base);ctx.lineTo(px+hw*1.35,base);ctx.closePath();ctx.fill();}
      // sanddyner
      ctx.fillStyle='#e9c988';
      for(let i=0;i<8;i++){const hx=(i*640-cam*0.45)%(VW+640)-200;ctx.beginPath();ctx.arc(hx,470,210,Math.PI,0);ctx.fill();}
      ctx.fillStyle='#dcb877';
      for(let i=0;i<8;i++){const hx=(i*520+260-cam*0.6)%(VW+520)-200;ctx.beginPath();ctx.arc(hx,485,160,Math.PI,0);ctx.fill();}
      // drivande sandkorn i luften
      ctx.fillStyle='rgba(240,214,150,.6)';
      for(let i=0;i<14;i++){ const px=((i*257-frame*(0.6+(i%3)*0.3)-cam*0.5)%VW+VW)%VW;
        const py=300+(i*53)%160+Math.sin((frame+i*41)*0.03)*8;
        ctx.fillRect(px,py,2+(i%2),1.5); }
    } else {
      // sol med glöd
      const sx=150-cam*0.03%VW;
      ctx.fillStyle='rgba(255,240,170,.35)';ctx.beginPath();ctx.arc(sx,78,56,0,7);ctx.fill();
      ctx.fillStyle='#fff3b0';ctx.beginPath();ctx.arc(sx,78,34,0,7);ctx.fill();
      // avlägsna blå berg
      ctx.fillStyle='rgba(122,160,200,.55)';
      for(let i=0;i<6;i++){const px=(i*820-cam*0.10)%(VW+820)-200, base=352, hw=210, h=150+((i*77)%60);
        ctx.beginPath();ctx.moveTo(px,base);ctx.lineTo(px+hw,base-h);ctx.lineTo(px+hw*2,base);ctx.closePath();ctx.fill();}
      // trädlinje-silhuett
      ctx.fillStyle='#78b581';
      for(let i=0;i<26;i++){const tx=(i*180-cam*0.18)%(VW+360)-120, th=46+((i*53)%38);
        ctx.beginPath();ctx.moveTo(tx-26,368);ctx.quadraticCurveTo(tx,368-th,tx+26,368);ctx.closePath();ctx.fill();}
      ctx.fillStyle='#78b581';ctx.fillRect(0,364,VW,30);
      // två lager kullar
      ctx.fillStyle='#93cc8f'; for(let i=0;i<8;i++){const hx=(i*700-cam*0.28)%(VW+700)-200;ctx.beginPath();ctx.arc(hx,VH+40,230,Math.PI,0);ctx.fill();}
      ctx.fillStyle='#a7d9a0'; for(let i=0;i<8;i++){const hx=(i*560+280-cam*0.4)%(VW+560)-200;ctx.beginPath();ctx.arc(hx,VH+60,200,Math.PI,0);ctx.fill();}
      const W=VW+700, t=frame*0.18;
      for(let i=0;i<7;i++){ const base=i*640+(i*151%110);
        const cx2=((base-cam*0.25-t)%W+W)%W-160, cy=52+(i%3)*44+Math.sin(frame*0.012+i)*3;
        cloud(cx2,cy,0.78+(i%3)*0.12); }
      // svävande frön/pollen
      ctx.fillStyle='rgba(255,255,240,.75)';
      for(let i=0;i<16;i++){ const px=((i*231+Math.sin((frame+i*61)*0.017)*46-cam*0.5)%VW+VW)%VW;
        const py=(i*97+frame*0.35+Math.sin((frame+i*31)*0.03)*14)%VH;
        ctx.fillRect(px,py,2,2); }
    }
  }

  // gräs & buskar (grönt) / torra strån (öken)
  function tuft(wx,topY,ph,dark){ const sway=Math.sin(frame*0.05+ph)*3.2;
    ctx.lineWidth=2; ctx.lineCap='round';
    for(let b=-2;b<=2;b++){ const bx=wx+b*3, h=8+((b+7)%3)*3, tipx=bx+sway*(1-Math.abs(b)*0.12)+b*1.4;
      ctx.strokeStyle=(b%2===0)?(dark?'#3f8a34':'#4e9e3e'):(dark?'#4e9e3e':'#7fd36a');
      ctx.beginPath(); ctx.moveTo(bx,topY); ctx.quadraticCurveTo((bx+tipx)/2,topY-h*0.6,tipx,topY-h); ctx.stroke(); } }
  function desertTuft(wx,topY,ph){ const sway=Math.sin(frame*0.05+ph)*3;
    ctx.lineWidth=2; ctx.lineCap='round';
    for(let b=-2;b<=2;b++){ const bx=wx+b*3, h=7+((b+7)%3)*3, tipx=bx+sway*(1-Math.abs(b)*0.12)+b*1.4;
      ctx.strokeStyle=(b%2===0)?'#b1913f':'#cdb15c';
      ctx.beginPath(); ctx.moveTo(bx,topY); ctx.quadraticCurveTo((bx+tipx)/2,topY-h*0.6,tipx,topY-h); ctx.stroke(); } }
  function bush(wx,topY){ const sway=Math.sin(frame*0.035+wx*0.02)*2;
    ctx.fillStyle='#3f8a34'; ctx.beginPath();
    ctx.ellipse(wx+sway,topY-14,20,15,0,0,7); ctx.ellipse(wx-15+sway*0.6,topY-8,13,11,0,0,7); ctx.ellipse(wx+15+sway*0.6,topY-8,13,11,0,0,7); ctx.fill();
    ctx.fillStyle='#5fb84e'; ctx.beginPath(); ctx.ellipse(wx-3+sway,topY-17,12,9,0,0,7); ctx.fill(); }
  function iceCrystal(wx,topY,ph){ const tw=Math.sin(frame*0.04+ph)*1.2;
    ctx.strokeStyle='#bfe2f5'; ctx.lineWidth=2; ctx.lineCap='round';
    for(let b=-1;b<=1;b++){ const h=8+((b+4)%2)*4;
      ctx.beginPath(); ctx.moveTo(wx+b*4,topY); ctx.lineTo(wx+b*5+tw,topY-h); ctx.stroke(); }
    ctx.fillStyle='rgba(255,255,255,.9)'; ctx.fillRect(wx-1,topY-9,2,2); }
  function greenery(pl){
    if(T.id==='ice'){ if(!pl.ground)return;
      for(let i=0;i*52<pl.w;i++){ const seed=pl.x+i*52; if(seed%156>=52)continue;
        const wx=pl.x-cam+i*52+14; if(wx<-30||wx>VW+30)continue; iceCrystal(wx,pl.y,seed*0.7); }
      return; }
    if(T.desert){ if(!pl.ground)return;
      for(let i=0;i*46<pl.w;i++){ const seed=pl.x+i*46; if(seed%138>=46)continue;
        const wx=pl.x-cam+i*46+12; if(wx<-30||wx>VW+30)continue; desertTuft(wx,pl.y,seed*0.7); }
      return; }
    const x=pl.x-cam;
    const from=Math.max(0,Math.floor((cam-pl.x)/26)), to=Math.ceil((cam+VW-pl.x)/26);
    for(let i=Math.max(0,from);i*26<pl.w&&i<=to;i++){ const wx=x+i*26+8; if(wx<-30||wx>VW+30)continue;
      const seed=(pl.x+i*26); if(pl.ground&&seed%182<26){ bush(wx,pl.y); } else { tuft(wx,pl.y,seed*0.7,!pl.ground); } } }
  // kant av gräs/snö/sand som hänger över blockets ovansida
  function topLip(x,y,w){
    ctx.fillStyle=T.platTop;
    for(let i=0;i<w;i+=14){ const bw=Math.min(14,w-i), r=4+((x+i)%3);
      ctx.beginPath(); ctx.ellipse(x+i+bw/2,y+3,bw/2+1,r,0,0,7); ctx.fill(); }
    ctx.fillStyle='rgba(255,255,255,.28)'; ctx.fillRect(x,y,w,2); }
  function drawPlat(pl){ const x=pl.x-cam, topH=T.desert?12:10;
    if(x+pl.w<-40||x>VW+40)return;
    if(pl.ground){
      ctx.save(); ctx.translate(x,pl.y); ctx.fillStyle=GROUND_PAT; ctx.fillRect(0,topH,pl.w,pl.h-topH); ctx.restore();
      ctx.fillStyle=T.platTop; ctx.fillRect(x,pl.y,pl.w,topH);
      topLip(x,pl.y+topH-3,pl.w);
      ctx.fillStyle='rgba(255,255,255,.20)';ctx.fillRect(x,pl.y,pl.w,2);
      ctx.fillStyle='rgba(255,255,255,.10)';ctx.fillRect(x,pl.y,2,pl.h);
      ctx.fillStyle='rgba(0,0,0,.16)';ctx.fillRect(x+pl.w-5,pl.y,5,pl.h);ctx.fillRect(x,pl.y+pl.h-4,pl.w,4);
      greenery(pl); return; }
    if(pl.mover){ ctx.fillStyle='#9aa7b5';ctx.fillRect(x,pl.y,pl.w,pl.h);ctx.fillStyle='#ced2da';ctx.fillRect(x,pl.y,pl.w,6);
      ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(x,pl.y,pl.w,1.5);
      ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(x,pl.y+pl.h-3,pl.w,3);ctx.fillRect(x+pl.w-3,pl.y,3,pl.h);
      return; }
    if(pl.crumble&&pl.phase===3)return;
    const jit=(pl.crumble&&pl.phase===1)?Math.sin(frame*1.7)*2:0, y=pl.y+(pl.yOff||0);
    ctx.save(); ctx.translate(jit,0);
    ctx.save(); ctx.translate(x,y); ctx.fillStyle=LEDGE_PAT; ctx.fillRect(0,0,pl.w,pl.h); ctx.restore();
    ctx.fillStyle=T.platTop;ctx.fillRect(x,y,pl.w,6);
    topLip(x,y+3,pl.w);
    ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(x,y,pl.w,1.5);
    ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(x,y+pl.h-3,pl.w,3);ctx.fillRect(x+pl.w-3,y,3,pl.h);
    if(pl.crumble){ ctx.strokeStyle='rgba(60,40,20,.55)';ctx.lineWidth=2;ctx.beginPath();
      ctx.moveTo(x+pl.w*0.3,y+3);ctx.lineTo(x+pl.w*0.38,y+pl.h-3);
      ctx.moveTo(x+pl.w*0.66,y+2);ctx.lineTo(x+pl.w*0.6,y+pl.h-2);ctx.stroke(); }
    ctx.restore();
    if(!pl.crumble||pl.phase===0)greenery(pl); }
  function drawFlag(fl){ const x=fl.x-cam; if(x<-50||x>VW+50)return;
    ctx.fillStyle='#5c452a';ctx.fillRect(x-2,groundTop-64,4,64);
    ctx.fillStyle=T.platBody;ctx.fillRect(x-6,groundTop-4,12,4);
    const w=Math.sin(frame*0.14+fl.x*0.05)*3;
    ctx.fillStyle=fl.passed?'#f4d64a':'#ced2da';
    ctx.beginPath();ctx.moveTo(x+2,groundTop-62);ctx.quadraticCurveTo(x+16+w,groundTop-58,x+27+w,groundTop-53);
    ctx.quadraticCurveTo(x+15+w,groundTop-49,x+2,groundTop-44);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#2a2830';ctx.lineWidth=2;ctx.stroke(); }
  function drawGoal(){ if(boss)return; const gx=LEVELW-100-cam; if(gx<-70||gx>VW+70)return;
    ctx.fillStyle='#5c452a';ctx.fillRect(gx-3,groundTop-150,6,150);
    const w2=Math.sin(frame*0.12)*4;
    ctx.fillStyle='#f4d64a';ctx.beginPath();ctx.moveTo(gx+3,groundTop-146);
    ctx.quadraticCurveTo(gx+26+w2,groundTop-138,gx+40+w2,groundTop-128);
    ctx.quadraticCurveTo(gx+24+w2,groundTop-120,gx+3,groundTop-112);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#2a2830';ctx.lineWidth=2;ctx.stroke(); }
  function drawBouncer(b){ const x=b.x-cam; if(x<-70||x>VW+70)return;
    const c=b.anim>0?Math.max(0.4,1-b.anim/14):1+Math.sin(b.t)*0.05, h=15*c;
    ctx.fillStyle='#2a2830';ctx.fillRect(x-10,groundTop-6,20,6);
    ctx.fillStyle='#e05a78';rr(x-b.w/2,groundTop-6-h,b.w,h+4,7);ctx.fill();
    ctx.fillStyle='#f4d64a';rr(x-b.w/2+4,groundTop-4-h,b.w-8,5,2.5);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=3;ctx.lineCap='round';
    const ay=groundTop-30-h-Math.abs(Math.sin(b.t*1.5))*5;
    ctx.beginPath();ctx.moveTo(x-7,ay+7);ctx.lineTo(x,ay);ctx.lineTo(x+7,ay+7);ctx.stroke(); }

  function drawBlob(e){ const x=e.x-cam;ctx.save();ctx.translate(x,e.y+e.h);ctx.scale(1,e.alive?1:Math.max(0.15,e.squish));
    const bob=e.alive?Math.sin(e.t)*2:0; ctx.fillStyle=T.enemyBody;rr(-e.w/2,-e.h+bob,e.w,e.h,8);ctx.fill();
    ctx.fillStyle='#2a2830';ctx.fillRect(-e.w/2+3,-4,8,5);ctx.fillRect(e.w/2-11,-4,8,5);
    ctx.fillStyle='#fff';ctx.fillRect(-8,-e.h+8+bob,7,8);ctx.fillRect(3,-e.h+8+bob,7,8);
    ctx.fillStyle='#2a2830';ctx.fillRect(-8+e.dir*2+2,-e.h+11+bob,3,4);ctx.fillRect(3+e.dir*2+2,-e.h+11+bob,3,4);ctx.restore(); }
  function drawLava(e){ const x=e.x-cam, sq=e.alive?1:Math.max(0.15,e.squish);
    ctx.save();ctx.translate(x,e.y+e.h);ctx.scale(1,sq);
    const s=e.w, gl=0.5+0.5*Math.abs(Math.sin(e.glow));
    ctx.fillStyle='rgba(255,120,20,'+(0.25*gl)+')';ctx.beginPath();ctx.arc(0,-s/2,s*0.9,0,7);ctx.fill();
    ctx.fillStyle='#3a2422';ctx.fillRect(-s/2,-s,s,s);
    const cg=ctx.createLinearGradient(0,-s,0,0);cg.addColorStop(0,'#ffd24a');cg.addColorStop(0.5,'#ff7a1a');cg.addColorStop(1,'#e23a13');
    ctx.fillStyle=cg;ctx.fillRect(-s/2+3,-s+3,s-6,s-6);
    ctx.strokeStyle='rgba(60,20,10,.7)';ctx.lineWidth=2;ctx.beginPath();
    ctx.moveTo(-s/2+5,-s*0.6);ctx.lineTo(-2,-s*0.55);ctx.lineTo(2,-s*0.3);ctx.moveTo(s/2-6,-s*0.7);ctx.lineTo(4,-s*0.5);ctx.stroke();
    ctx.fillStyle='rgba(255,240,180,'+gl+')';ctx.fillRect(-3,-s*0.7,3,3);ctx.fillRect(4,-s*0.4,2,2);
    ctx.restore(); }
  function drawEnemy(e){ if(T.desert)drawLava(e); else drawBlob(e); }
  function drawCoin(c){ if(c.got)return;const x=c.x-cam,y=c.y+Math.sin(c.t*0.8)*2,sx=Math.abs(Math.cos(c.t));
    if(x<-30||x>VW+30)return;
    ctx.save();ctx.translate(x,y);ctx.scale(sx*0.85+0.15,1);
    ctx.drawImage(COIN_TEX,-13,-13);ctx.restore();
    const gl=Math.sin(c.t*1.7); if(gl>0.93){ ctx.fillStyle='rgba(255,255,255,'+((gl-0.93)*10)+')';
      ctx.save();ctx.translate(x+6,y-7);ctx.rotate(0.78);ctx.fillRect(-4,-1,8,2);ctx.fillRect(-1,-4,2,8);ctx.restore(); } }
  function drawShop(s){ const x=s.x-cam, base=s.y; if(x<-90||x>VW+90)return;
    const w=SHOP_W, h=SHOP_H, sway=Math.sin(frame*0.03+s.x)*1.2;
    ctx.fillStyle='#2a2830'; ctx.fillRect(x-w/2,base-h+16,5,h-16); ctx.fillRect(x+w/2-5,base-h+16,5,h-16);
    ctx.fillStyle=T.desert?'#c99a5b':'#8a5a2b'; ctx.fillRect(x-w/2+4,base-26,w-8,26);
    ctx.fillStyle=T.desert?'#e8c579':'#6bbf59'; ctx.fillRect(x-w/2+4,base-26,w-8,5);
    const seg=(w+12)/6;
    for(let i=0;i<6;i++){ ctx.fillStyle=i%2?'#fff':'#f4d64a'; ctx.fillRect(x-w/2-6+i*seg,base-h+8+sway,seg,12); }
    ctx.fillStyle='#2a2830'; ctx.fillRect(x-w/2-6,base-h+4+sway,w+12,4);
    const pu=1+0.12*Math.sin(frame*0.08);
    ctx.fillStyle='#f4d64a'; ctx.beginPath(); ctx.arc(x,base-h+36,8*pu,0,7); ctx.fill();
    ctx.fillStyle='#caa72f'; ctx.beginPath(); ctx.arc(x,base-h+36,4.5*pu,0,7); ctx.fill(); }

  function drawFG(){
    ctx.fillStyle=T.fg;
    for(let i=0;i<9;i++){ const fx=((i*430-cam*1.35)%(VW+430)+VW+430)%(VW+430)-160, r=52+(i%3)*26;
      ctx.beginPath(); ctx.arc(fx,VH+36,r,Math.PI,0); ctx.fill(); }
    ctx.strokeStyle=T.fg; ctx.lineWidth=3; ctx.lineCap='round';
    for(let i=0;i<12;i++){ const fx=((i*310+130-cam*1.5)%(VW+310)+VW+310)%(VW+310)-120, sw=Math.sin(frame*0.04+i)*4;
      ctx.beginPath(); ctx.moveTo(fx,VH); ctx.quadraticCurveTo(fx+2,VH-16,fx+sw,VH-30); ctx.stroke(); } }
  function hud(){ const maxH=Math.max(3,player.hearts);
    const pw=Math.max(friendsTotal>0?186:150,maxH*26+(gear.shield?34:0)+18);
    ctx.fillStyle='rgba(255,255,255,.30)'; rr(6,8,pw,62,12); ctx.fill();
    ctx.strokeStyle='rgba(42,40,48,.25)'; ctx.lineWidth=2; rr(6,8,pw,62,12); ctx.stroke();
    for(let i=0;i<maxH;i++){ctx.font='22px sans-serif';ctx.fillText(i<player.hearts?'\u2764\ufe0f':'\ud83e\udd0d',14+i*26,32);}
    if(gear.shield){ctx.font='20px sans-serif';ctx.fillText('\ud83d\udee1\ufe0f',14+maxH*26+4,32);}
    ctx.fillStyle=T.hudText;ctx.font='bold 20px system-ui,sans-serif';ctx.fillText('\ud83e\ude99 '+wallet,14,62);
    if(friendsTotal>0)ctx.fillText('\ud83d\udc3e '+player.rescued+'/'+friendsTotal,110,62);
    if(boss&&!boss.dead&&player.x>boss.homeX-360){ ctx.fillStyle=T.hudPanel;rr(VW/2-110,16,220,26,13);ctx.fill();
      ctx.fillStyle='#e05a78';rr(VW/2-106,20,212*(boss.hp/3),18,9);ctx.fill();
      ctx.fillStyle='#fff';ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillText('BOSS: IsIs',VW/2,58);ctx.textAlign='left';}
    if(msgT>0){ctx.globalAlpha=Math.min(1,msgT/40);ctx.fillStyle=T.hudText;ctx.font='bold 26px system-ui';ctx.textAlign='center';ctx.fillText(msg,VW/2,130);ctx.textAlign='left';ctx.globalAlpha=1;} }
  function overlayText(lines){ ctx.fillStyle=T.overlay;ctx.fillRect(0,0,VW,VH);ctx.textAlign='center';
    lines.forEach(l=>{ctx.fillStyle=l.c||'#fff';ctx.font='bold '+l.s+'px system-ui,sans-serif';ctx.fillText(l.t,VW/2,l.y);});ctx.textAlign='left'; }
  function drawShopMenu(){ shopHits=[];
    ctx.fillStyle='rgba(20,12,40,.62)'; ctx.fillRect(0,0,VW,VH);
    const px=VW/2-250, py=34, pw=500;
    ctx.fillStyle='#342a4f'; rr(px,py,pw,412,18); ctx.fill();
    ctx.strokeStyle='#f4d64a'; ctx.lineWidth=3; rr(px,py,pw,412,18); ctx.stroke();
    ctx.textAlign='center'; ctx.fillStyle='#f4d64a'; ctx.font='bold 26px system-ui';
    ctx.fillText('\ud83c\udfea Aff\u00e4ren', VW/2, py+34);
    ctx.fillStyle='#fff'; ctx.font='bold 19px system-ui';
    ctx.fillText('Du har \ud83e\ude99 '+wallet, VW/2, py+60);
    let ry=py+74;
    ITEMS.forEach((it,i)=>{ const st=canBuy(it), afford=wallet>=it.price;
      ctx.fillStyle=st?'#2a2340':(afford?'#4b3f6b':'#3a3154'); rr(px+16,ry,pw-32,46,10); ctx.fill();
      ctx.textAlign='left'; ctx.fillStyle=st?'#8d80b5':'#fff'; ctx.font='bold 17px system-ui';
      ctx.fillText(it.name, px+30, ry+20);
      ctx.fillStyle=st?'#6d629b':'#b9aede'; ctx.font='13px system-ui';
      ctx.fillText(it.desc, px+30, ry+38);
      ctx.textAlign='right'; ctx.font='bold 17px system-ui';
      if(st){ ctx.fillStyle='#8d80b5'; ctx.fillText(st, px+pw-30, ry+29); }
      else { ctx.fillStyle=afford?'#f4d64a':'#7d6ea8'; ctx.fillText('\ud83e\ude99 '+it.price, px+pw-30, ry+29); }
      if(!st)shopHits.push({x:px+16,y:ry,w:pw-32,h:46,buy:i});
      ry+=54; });
    const bw=220, bx=VW/2-bw/2, by=ry+2;
    ctx.fillStyle='#f4d64a'; rr(bx,by,bw,42,12); ctx.fill();
    ctx.fillStyle='#2b2440'; ctx.font='bold 18px system-ui'; ctx.textAlign='center';
    ctx.fillText(shopReturn==='title'?'Till start \u25b6':'Forts\u00e4tt \u25b6', VW/2, by+27);
    shopHits.push({x:bx,y:by,w:bw,h:42,buy:null});
    ctx.textAlign='left'; }

  // ---- fusk-ljus ----
  function makeGlow(r,g,b){ const s=128,c=document.createElement('canvas');c.width=c.height=s;const gx=c.getContext('2d');
    const gr=gx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
    gr.addColorStop(0,'rgba('+r+','+g+','+b+',0.95)');gr.addColorStop(0.35,'rgba('+r+','+g+','+b+',0.42)');gr.addColorStop(1,'rgba('+r+','+g+','+b+',0)');
    gx.fillStyle=gr;gx.fillRect(0,0,s,s);return c; }
  function makeVignette(){ const c=document.createElement('canvas');c.width=VW;c.height=VH;const gx=c.getContext('2d');
    const gr=gx.createRadialGradient(VW/2,VH*0.46,VH*0.34,VW/2,VH/2,VH*0.98);
    gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,T.vign);
    gx.fillStyle=gr;gx.fillRect(0,0,VW,VH);return c; }
  const GLOW={coin:makeGlow(255,226,120),boss:makeGlow(150,205,255),ice:makeGlow(150,220,240),lava:makeGlow(255,150,60),sun:makeGlow(255,232,160)};
  const VIGN=makeVignette();
  function light(x,y,rad,tex,a){ if(a<=0)return; ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.min(1,a);ctx.drawImage(tex,x-rad,y-rad,rad*2,rad*2);ctx.restore(); }
  function shadow(x,gy,w,a){ ctx.save();ctx.globalAlpha=a;ctx.fillStyle=T.shadow;ctx.beginPath();ctx.ellipse(x,gy,w,w*0.28,0,0,7);ctx.fill();ctx.restore(); }
  function shadowPass(){ const p=player;
    if(p.onGround) shadow(p.x+p.w/2-cam,p.y+p.h-2,p.w*0.55,T.desert?0.22:0.20);
    for(const e of enemies){ if(e.alive) shadow(e.x-cam,e.y+e.h,e.w*0.55,T.desert?0.20:0.18); }
    for(const f of friends){ if(!f.got) shadow(f.x-cam,f.y,20,T.desert?0.16:0.15); }
    for(const b of bouncers) shadow(b.x-cam,groundTop,b.w*0.42,0.14); }
  function lightingPass(){
    if(T.desert){ const sx=740-cam*0.05%VW; light(sx,90,120,GLOW.sun,0.5); }
    else if(T.id==='ice'){ const sx=700-cam*0.03%VW; light(sx,70,90,GLOW.sun,0.3); }
    else { const sx=150-cam*0.03%VW; light(sx,78,110,GLOW.sun,0.4); }
    for(const b of bouncers) light(b.x-cam,groundTop-14,26,GLOW.coin,0.18+0.08*Math.sin(b.t));
    for(const fl of flags){ if(fl.passed) light(fl.x-cam,groundTop-52,24,GLOW.coin,0.3); }
    if(!boss) light(LEVELW-100-cam,groundTop-125,40,GLOW.coin,0.35+0.1*Math.sin(frame*0.07));
    for(const s of shops) light(s.x-cam,s.y-42,46,GLOW.coin,0.32+0.1*Math.sin(frame*0.06));
    for(const c of coins){ if(!c.got) light(c.x-cam,c.y,22,GLOW.coin,0.4+0.14*Math.sin(c.t*2)); }
    if(T.desert)for(const e of enemies){ if(e.alive) light(e.x-cam,e.y+e.h/2,38,GLOW.lava,0.4+0.25*Math.abs(Math.sin(e.glow))); }
    if(boss&&!boss.dead) light(boss.x-cam,boss.y+boss.h/2,72,GLOW.boss,0.4+0.1*Math.sin(boss.t*3)+(boss.hitFlash>0?0.25:0));
    for(const s of iceShots) light(s.x-cam,s.y,18,GLOW.ice,0.55); }

  function draw(){
    const shx=shake>0?(Math.random()-0.5)*shake:0, shy=shake>0?(Math.random()-0.5)*shake*0.7:0;
    ctx.save(); ctx.translate(shx,shy);
    drawBG(); for(const pl of plats)drawPlat(pl); for(const b of bouncers)drawBouncer(b); for(const fl of flags)drawFlag(fl); drawGoal(); for(const s of shops)drawShop(s); shadowPass(); for(const c of coins)drawCoin(c);
    for(const f of friends){ if(!f.got){const fy=f.y+Math.sin(f.bob)*3; spr(f.key==='liggy'?((Math.floor(f.bob*1.5)%2===0)?IMG['liggy']:IMG['liggyB']):IMG[f.key],f.x-cam,fy,f.drawH,f.key==='liggy',0);
      if(T.desert){ctx.fillStyle='rgba(244,214,74,.95)';ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillText('!',f.x-cam,f.y-f.drawH-6);ctx.textAlign='left';}} }
    for(const e of enemies)drawEnemy(e);
    // räddade kompisar följer efter i PiggyPiggys fotspår
    const followers=friends.filter(f=>f.got&&!f.playing).sort((a,b)=>a.order-b.order);
    followers.forEach((f,i)=>{ if(!trail.length)return;
      const t=trail[Math.max(0,trail.length-1-(i+1)*14)];
      f.bob+=t.moving?0.22:0.06;
      const img=f.key==='liggy'?((Math.floor(f.bob*1.5)%2===0)?IMG['liggy']:IMG['liggyB']):IMG[f.key];
      shadow(t.x-cam+14,t.y-2,18,0.15);
      spr(img,t.x-cam,t.y+Math.sin(f.bob)*2,f.drawH,t.face<0,0); });
    if(boss&&!boss.dead){ spr(boss.flap?IMG['bossDown']:IMG['bossUp'], boss.x-cam, boss.y+boss.h, boss.h+34, false, boss.hitFlash>0?0.6*(boss.hitFlash/30):0); }
    for(const s of iceShots)drawIce(s);
    const p=player, CH=CHARS[hero];
    if(!(p.inv>0&&frame%8<4)){ const bob=p.onGround?Math.sin(p.anim)*2:0;
      const img=(p.onGround&&Math.abs(p.vx)>0.5)?IMG[CH.walk[Math.floor(p.anim)%2]]:IMG[CH.idle];
      const st=p.stretch||1, ax=p.x+p.w/2-cam+28, ay=p.y+p.h+bob;
      ctx.save(); ctx.translate(ax,ay); ctx.scale(2-st,st); ctx.translate(-ax,-ay);
      spr(img,p.x+p.w/2-cam,p.y+p.h+bob,CH.h,p.face<0,0); ctx.restore(); }
    for(const q of parts){ ctx.globalAlpha=Math.max(0,q.life/q.max); ctx.fillStyle=q.col; ctx.fillRect(q.x-cam-1.5,q.y-1.5,3,3); }
    ctx.globalAlpha=1;
    drawFG();
    lightingPass();
    const prog=Math.min(1,cam/Math.max(1,LEVELW-VW));
    ctx.fillStyle='rgba(255,150,70,'+(0.10*prog).toFixed(3)+')'; ctx.fillRect(-20,-20,VW+40,VH+40);
    ctx.restore();
    ctx.drawImage(VIGN,0,0); hud();
    titleShopRect=null; charRects=[];
    if(state==='title'){ overlayText(opts.title||[]);
      // hjälteval
      const keys=['piggy','liggy','ziggy'], cw=152, chh=80, gap=14;
      const total=keys.length*cw+(keys.length-1)*gap; let cx0=VW/2-total/2;
      ctx.textAlign='center';
      keys.forEach(k=>{ const C=CHARS[k], sel=(chosenHero===k);
        ctx.fillStyle=sel?'#4b3f6b':'rgba(30,22,50,.75)'; rr(cx0,286,cw,chh,12); ctx.fill();
        ctx.strokeStyle=sel?'#f4d64a':'rgba(255,255,255,.35)'; ctx.lineWidth=sel?3:2; rr(cx0,286,cw,chh,12); ctx.stroke();
        if(IMG[C.idle]&&IMG[C.idle].complete)spr(IMG[C.idle],cx0+16,286+52,40,k==='liggy',0);
        ctx.fillStyle=sel?'#f4d64a':'#fff'; ctx.font='bold 15px system-ui';
        ctx.fillText(C.name,cx0+cw/2+16,286+34);
        ctx.fillStyle=sel?'#ffe9c0':'#b9aede'; ctx.font='12px system-ui';
        ctx.fillText(C.skill,cx0+cw/2+16,286+54);
        charRects.push({x:cx0,y:286,w:cw,h:chh,key:k});
        cx0+=cw+gap; });
      ctx.textAlign='left';
      const bw=250, bx=VW/2-bw/2, by=VH-88;
      ctx.fillStyle='#f4d64a'; rr(bx,by,bw,44,14); ctx.fill();
      ctx.fillStyle='#2b2440'; ctx.font='bold 18px system-ui'; ctx.textAlign='center';
      ctx.fillText('\ud83c\udfea Handla f\u00f6rst  (\ud83e\ude99 '+wallet+')', VW/2, by+28); ctx.textAlign='left';
      titleShopRect={x:bx,y:by,w:bw,h:44}; }
    if(state==='win')overlayText([{t:'DU VANN! \ud83d\udc51',s:52,y:150,c:'#f4d64a'},{t:'Kompisar: '+player.rescued+'/'+friendsTotal+'   Mynt: \ud83e\ude99 '+wallet,s:22,y:210,c:'#fff'},{t:'Tryck f\u00f6r att spela igen',s:22,y:300,c:'#f4d64a'}]);
    if(state==='lose')overlayText([{t:'Aj d\u00e5!',s:48,y:170,c:'#e05a78'},{t:'Dina mynt \u00e4r kvar: \ud83e\ude99 '+wallet,s:20,y:225,c:'#fff'},{t:'Tryck f\u00f6r att f\u00f6rs\u00f6ka igen',s:22,y:270,c:'#f4d64a'}]);
    if(state==='shop')drawShopMenu();
  }

  let raf=null, running=true;
  function loop(){ if(!running)return; update(); draw(); raf=requestAnimationFrame(loop); }
  ks.forEach(k=>{const im=new Image();im.onload=()=>{loaded++;if(loaded===ks.length){reset(); if(opts.title)state='title'; loop();}};im.src=ASSETS[k];IMG[k]=im;});
  const api={ stop(){ running=false; if(raf)cancelAnimationFrame(raf);
    removeEventListener('keydown',kd);removeEventListener('keyup',ku);
    canvas.removeEventListener('pointerdown',canvasTap);
    btns.forEach(([el,d,u])=>{el.removeEventListener('pointerdown',d);el.removeEventListener('pointerup',u);el.removeEventListener('pointerleave',u);el.removeEventListener('pointercancel',u);}); } };
  if(opts.debug) api.dbg=()=>({state:state,player:player,hero:hero,wallet:wallet,perks:perks,gear:gear,boss:boss,enemies:enemies,friends:friends,oneways:oneways,bouncers:bouncers,shops:shops,cam:cam,trail:trail,parts:parts,shake:shake,movers:movers,flags:flags});
  return api;
};
