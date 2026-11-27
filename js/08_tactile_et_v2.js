/* SCANEBOOK – 08_tactile_et_v2.js : Tactile iPhone/iPad, ajouts V2.20 et suivants (types, réglage fin, étagères).
   Les fichiers js/ sont chargés dans l'ordre par index.html et partagent les mêmes variables globales. */
'use strict';
/* =====================================================================
   V2.3 – TACTILE (iPhone / iPad) : doigt -> souris, pincer -> zoom,
   double-tap -> zoom, appui long -> sélection, balayage dans la fiche
   ===================================================================== */
(function () {
  if (!IS_TOUCH) return;
  document.documentElement.classList.add('touch');
  const ZONES = '#viewport,#ogC,#qeWrap,#spW,#edCan,#lpW,.b3v';
  const fire = (type, t, target, extra = {}) => { const ev = new MouseEvent(type, {bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY, button: 0, buttons: type === 'mouseup' ? 0 : 1, view: window, ...extra}); (target || document.elementFromPoint(t.clientX, t.clientY) || document.body).dispatchEvent(ev); };
  // V2.15: immediate swipe pans; only a stationary 600 ms hold arms a book/shelf drag.
  let st = null, pinch = null, lastTap = {t: 0, x: 0, y: 0}, lpTimer = 0;
  const point = t => ({clientX:t.clientX,clientY:t.clientY});
  function cancelRoomDrag(){
    clearTimeout(lpTimer);
    if(st?.target?.closest)st.target.closest('.book,.shgrip')?.classList.remove('touch-ready');
    if(drag){drag.el?.classList.remove('lifted');drag=null;}
    $('#dragGhost')?.remove();$('#dropMark').style.display='none';$('#unit').classList.remove('dragging');
    if(sdrag){sdrag.grps.forEach(g=>{g.style.transform='';g.classList.remove('lift','anim');});sdrag=null;}
    document.body.classList.remove('dnd');document.body.style.cursor='';
    $$('#caseBar .dropok,#caseBar .dropok.over,.dropz.over').forEach(el=>el.classList.remove('dropok','over'));
    pan=null;VP.classList.remove('panning');
  }
  function tapRoom(s0,t){
    const now=Date.now();
    if(now-lastTap.t<320&&Math.hypot(t.clientX-lastTap.x,t.clientY-lastTap.y)<30){lastTap.t=0;fire('dblclick',t,s0.target);}
    else{lastTap={t:now,x:t.clientX,y:t.clientY};fire('click',t,s0.target);}
  }
  document.addEventListener('touchstart', e => {
    const zone=e.target.closest&&e.target.closest(ZONES);if(!zone)return;
    if(e.target.closest('button,select,input,a,.dd,.ddw,label'))return;
    e.preventDefault();
    if(e.touches.length>=2){
      if(st?.room)cancelRoomDrag();else if(st?.down)fire('mouseup',st.last,null);
      clearTimeout(lpTimer);st=null;lastTap.t=0;
      const [a,b]=e.touches;pinch={d:Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)),cx:(a.clientX+b.clientX)/2,cy:(a.clientY+b.clientY)/2,zone};return;
    }
    if(pinch||e.touches.length!==1)return;
    const t=point(e.touches[0]),room=zone.id==='viewport';
    st={x:t.clientX,y:t.clientY,last:t,target:e.target,moved:false,down:!room,room,zone,time:Date.now(),armed:false,px:VIEW.px,py:VIEW.py};
    if(!room){fire('mousedown',t,e.target);return;}
    const item=e.target.closest('#unit .book,#unit .shgrip');
    if(item&&!CAM.sel){lpTimer=setTimeout(()=>{
      if(!st||st.moved||!st.room)return;
      st.armed=true;st.down=true;lastTap.t=0;item.classList.add('touch-ready');
      fire('mousedown',st.last,st.target);
      if(navigator.vibrate)navigator.vibrate(20);
    },holdDelay18());}
  },{passive:false});
  document.addEventListener('touchmove',e=>{
    if(pinch&&e.touches.length===2){e.preventDefault();const [a,b]=e.touches,d=Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)),f=d/pinch.d;pinch.d=d;
      const cx=(a.clientX+b.clientX)/2,cy=(a.clientY+b.clientY)/2;
      pinch.zone.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:cx,clientY:cy,deltaY:-Math.log(f)/.0015}));
      if(pinch.zone.id==='viewport'){VIEW.px+=cx-pinch.cx;VIEW.py+=cy-pinch.cy;applyView();}pinch.cx=cx;pinch.cy=cy;return;}
    if(!st||!e.touches.length)return;e.preventDefault();const t=point(e.touches[0]);st.last=t;
    if(Math.hypot(t.clientX-st.x,t.clientY-st.y)>8){st.moved=true;clearTimeout(lpTimer);lastTap.t=0;}
    if(st.room&&!st.armed){if(st.moved){VIEW.px=st.px+t.clientX-st.x;VIEW.py=st.py+t.clientY-st.y;VP.classList.add('panning');applyView();}return;}
    if(st.down)fire('mousemove',t,null);
  },{passive:false});
  document.addEventListener('touchend',e=>{
    if(pinch){if(!e.touches.length)pinch=null;return;}
    if(!st)return;clearTimeout(lpTimer);const s0=st;st=null;const t=point(e.changedTouches[0]);
    s0.target.closest?.('.book,.shgrip')?.classList.remove('touch-ready');VP.classList.remove('panning');
    if(s0.room){
      if(s0.armed){if(s0.moved)fire('mouseup',t,null);else cancelRoomDrag();return;}
      if(!s0.moved)tapRoom(s0,t);return;
    }
    if(s0.down)fire('mouseup',t,null);
    if(!s0.moved&&Date.now()-s0.time<550)tapRoom(s0,t);
  },{passive:false});
  document.addEventListener('touchcancel',()=>{clearTimeout(lpTimer);if(st?.room)cancelRoomDrag();else if(st?.down)fire('mouseup',st.last,null);st=null;pinch=null;lastTap.t=0;});
  // balayage gauche / droite dans la fiche ouvrage : livre précédent / suivant
  let sw = null;
  document.addEventListener('touchstart', e => { const d = e.target.closest && e.target.closest('#dBody'); if (!d || e.touches.length !== 1 || e.target.closest('input,textarea,select,.b3v')) { sw = null; return; } const t = e.touches[0]; sw = {x: t.clientX, y: t.clientY, time: Date.now()}; }, {passive: true});
  document.addEventListener('touchend', e => { if (!sw) return; const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y; const s1 = sw; sw = null;
    if (Date.now() - s1.time < 600 && Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy) && typeof goNav === 'function' && NAV.cur) goNav(dx < 0 ? 1 : -1); }, {passive: true});
  // astuces adaptées
  const tip = document.querySelector('#welcome p'); if (tip) tip.textContent = 'Photographie les tranches de tes livres, BD ou mangas avec ton iPhone ou ton iPad : SCANEBOOK les reconnaît et les range sur tes étagères.';
  const w1 = document.querySelector('.wcard[data-act=cam] span'); if (w1) w1.textContent = 'Appareil photo';
  const w2 = document.querySelector('.wcard[data-act=imp] span'); if (w2) w2.textContent = 'Depuis Photos ou Fichiers';
})();
/* installation sur l'écran d'accueil (iOS) : rappel une seule fois */
(function () {
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (IS_IOS && !standalone && !localStorage.getItem('scanly_a2hs')) { localStorage.setItem('scanly_a2hs', '1');
    setTimeout(() => toast('Astuce : Partager ⬆ puis « Sur l\'écran d\'accueil » pour installer SCANEBOOK comme une app', 8000), 2500); }
})();

(function(){const lib=document.getElementById('v-lib'),btn=document.getElementById('smartMode');let quick=localStorage.getItem('scanly_smart_read')==='1';function update(){lib.classList.toggle('smart-read',quick);btn.setAttribute('aria-pressed',String(quick));btn.classList.toggle('on',quick);btn.textContent=quick?'Immersion 3D':'Lecture rapide';btn.title=quick?'Revenir aux perspectives 3D':'Vue frontale et effets réduits';}btn.addEventListener('click',function(e){e.stopPropagation();quick=!quick;localStorage.setItem('scanly_smart_read',quick?'1':'0');update();});update();})();
/* SCANEBOOK V2.20 – détourage précis.
   Un vrai bord de livre est une ligne continue sur presque toute la hauteur : on mesure la
   présence du contour bande par bande (le texte du titre, présent seulement par endroits,
   est écarté), on tient compte des couleurs et du sillon sombre entre deux livres, puis
   chaque bord est ajusté séparément par une droite (perspective). */
function edgeMaps20(cv){
  const w=cv.width,h=cv.height,d=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data,n=w*h;
  const L=new Float32Array(n),A=new Float32Array(n),B=new Float32Array(n);
  for(let i=0,j=0;j<n;i+=4,j++){const r=d[i],g=d[i+1],b=d[i+2];L[j]=.299*r+.587*g+.114*b;A[j]=.7*(r-g);B[j]=.7*((r+g)/2-b);}
  const ex=new Float32Array(n),ey=new Float32Array(n);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,a=i-w,c=i+w;
    const lx=(L[a+1]+2*L[i+1]+L[c+1])-(L[a-1]+2*L[i-1]+L[c-1]),ly=(L[c-1]+2*L[c]+L[c+1])-(L[a-1]+2*L[a]+L[a+1]);
    const ax=(A[a+1]+2*A[i+1]+A[c+1])-(A[a-1]+2*A[i-1]+A[c-1]),ay=(A[c-1]+2*A[c]+A[c+1])-(A[a-1]+2*A[a]+A[a+1]);
    const bx=(B[a+1]+2*B[i+1]+B[c+1])-(B[a-1]+2*B[i-1]+B[c-1]),by=(B[c-1]+2*B[c]+B[c+1])-(B[a-1]+2*B[a]+B[a+1]);
    const mx=Math.sqrt(lx*lx+ax*ax+bx*bx),my=Math.sqrt(ly*ly+ay*ay+by*by);
    ex[i]=mx>.7*my?mx:.25*mx;ey[i]=my>.7*mx?my:.25*my;}
  return {w,h,L,A,B,ex,ey};
}
function pct20(arr,p){const s=Float32Array.from(arr).sort();return s.length?s[Math.min(s.length-1,Math.max(0,Math.floor(p*(s.length-1))))]:0;}
/* profil « présent sur toute la hauteur » des contours verticaux, entre ya et yb */
function vConsistency20(M,ya,yb,nb,x0,x1){
  const {w,ex,L}=M,bands=[],dark=[],step=Math.max(1,(yb-ya)/nb);x0=Math.max(1,Math.floor(x0));x1=Math.min(w-2,Math.ceil(x1));
  for(let j=0;j<nb;j++){const y0=Math.round(ya+j*step),y1=Math.max(y0+1,Math.round(ya+(j+1)*step)),P=new Float32Array(w),ML=new Float32Array(w);
    for(let y=y0;y<y1;y++){const o=y*w;for(let x=x0;x<=x1;x++){P[x]+=ex[o+x];ML[x]+=L[o+x];}}
    const rows=y1-y0;for(let x=x0;x<=x1;x++){P[x]/=rows;ML[x]/=rows;}
    const sc=pct20(P.subarray(x0,x1+1),.85)+1e-3,Q=new Float32Array(w);for(let x=x0;x<=x1;x++)Q[x]=Math.min(2.5,Math.max(P[x-1]||0,P[x],P[x+1]||0)/sc);bands.push(Q);
    const r=2,V=new Float32Array(w);for(let x=x0+r;x<=x1-r;x++)V[x]=Math.max(0,(ML[x-r]+ML[x+r])/2-ML[x]);const vs=pct20(V.subarray(x0,x1+1),.9)+4,Vn=new Float32Array(w);for(let x=x0;x<=x1;x++)Vn[x]=Math.min(2,V[x]/vs);dark.push(Vn);}
  const S=new Float32Array(w),lo=Math.floor(nb*.2),hi=Math.max(lo+1,Math.ceil(nb*.6)),vals=new Float32Array(nb),dv=new Float32Array(nb);
  for(let x=x0;x<=x1;x++){let mean=0;for(let j=0;j<nb;j++){vals[j]=bands[j][x];dv[j]=dark[j][x];mean+=vals[j];}vals.sort();dv.sort();let core=0;for(let j=lo;j<hi;j++)core+=vals[j];let dk=0;for(let j=lo;j<hi;j++)dk+=dv[j];
    S[x]=core/(hi-lo)+.25*mean/nb+.35*dk/(hi-lo);}
  return S;
}
/* ajuste une droite x = a + b·(y − ym) sur le bord le plus net autour de x0, bande par bande */
function fitEdge20(M,x0,ya,yb,win,nb=16){
  const {w,ex}=M,pts=[],step=(yb-ya)/nb,ym=(ya+yb)/2;
  for(let j=0;j<nb;j++){const y0=Math.round(ya+j*step),y1=Math.max(y0+1,Math.round(ya+(j+1)*step)),a=Math.max(1,Math.floor(x0-win)),b=Math.min(w-2,Math.ceil(x0+win));if(b-a<2)continue;
    const P=new Float32Array(b-a+1);for(let y=y0;y<y1;y++){const o=y*w;for(let x=a;x<=b;x++)P[x-a]+=ex[o+x];}
    let bi=0,bv=-1;for(let i=0;i<P.length;i++){const v=P[i]*(1-.25*Math.abs(a+i-x0)/Math.max(1,win));if(v>bv){bv=v;bi=i;}}
    let sub=0;if(bi>0&&bi<P.length-1){const l=P[bi-1],c=P[bi],r=P[bi+1],den=l-2*c+r;if(den<0)sub=Math.max(-.5,Math.min(.5,.5*(l-r)/den));}
    const mean=P.reduce((s,v)=>s+v,0)/P.length;if(P[bi]>1.25*mean)pts.push({y:(y0+y1)/2-ym,x:a+bi+sub,wt:P[bi]-mean});}
  const fit=list=>{let sw=0,sy=0,sx=0,syy=0,sxy=0;list.forEach(p=>{sw+=p.wt;sy+=p.wt*p.y;sx+=p.wt*p.x;syy+=p.wt*p.y*p.y;sxy+=p.wt*p.x*p.y;});const den=sw*syy-sy*sy;const b=Math.abs(den)>1e-9?(sw*sxy-sy*sx)/den:0,bb=Math.max(-.07,Math.min(.07,b));return {a:(sx-bb*sy)/Math.max(1e-9,sw),b:bb};};
  if(pts.length<Math.max(4,nb*.35))return {at:y=>x0,ok:false};
  let F=fit(pts),use=pts;for(let it=0;it<2;it++){const res=use.map(p=>Math.abs(p.x-(F.a+F.b*p.y))),mad=pct20(res,.5);const keep=use.filter((p,i)=>res[i]<=Math.max(1.2,2.5*mad));if(keep.length<Math.max(4,nb*.35))break;use=keep;F=fit(use);}
  if(Math.abs(F.a+F.b*0-x0)>win*1.05)return {at:y=>x0,ok:false};
  return {at:y=>F.a+F.b*(y-ym),ok:true,n:use.length};
}
/* bord haut / bas : changement net de couleur entre la tranche et ce qui est au-dessus / en dessous */
function hStep20(M,xL,xR,y,s){const {w,L,A,B}=M;let n=0,nu=0,up=[0,0,0],dn=[0,0,0];
  for(let k=1;k<=s;k++){const ya=y-k,yb=y+k;if(ya<0||yb>=M.h)continue;const a=Math.round(xL(ya)),b=Math.round(xR(ya)),c=Math.round(xL(yb)),d=Math.round(xR(yb)),wa=b-a,wb=d-c;if(wa<3||wb<3)continue;
    for(let x=a+Math.ceil(wa*.18);x<=b-Math.ceil(wa*.18);x++){const i=ya*w+x;up[0]+=L[i];up[1]+=A[i];up[2]+=B[i];nu++;}
    for(let x=c+Math.ceil(wb*.18);x<=d-Math.ceil(wb*.18);x++){const i=yb*w+x;dn[0]+=L[i];dn[1]+=A[i];dn[2]+=B[i];n++;}}
  if(!n||!nu)return 0;const m=up.map(v=>v/nu),q=dn.map(v=>v/n);return Math.sqrt((m[0]-q[0])**2+(m[1]-q[1])**2+(m[2]-q[2])**2);}
function autoQuad20(img,B,tHint=null,opts={}){
  const local=!!opts.local,IW=imgW(img),IH=imgH(img),bw=Math.max(2,B.x1-B.x0),bh=Math.max(4,B.y1-B.y0);
  const mx=(local?.45:.7)*bw+.06*bh,my=(local?.1:.14)*bh;
  const rx0=clamp(B.x0-mx,0,IW),rx1=clamp(B.x1+mx,0,IW),ry0=clamp(B.y0-my,0,IH),ry1=clamp(B.y1+my,0,IH);
  const k=Math.min(3,720/Math.max(1,ry1-ry0)),w=Math.max(12,Math.round((rx1-rx0)*k)),h=Math.max(12,Math.round((ry1-ry0)*k));
  const C0=document.createElement('canvas');C0.width=w;C0.height=h;const c0=C0.getContext('2d');c0.imageSmoothingQuality='high';c0.drawImage(img,rx0,ry0,rx1-rx0,ry1-ry0,0,0,w,h);
  const bx0=(B.x0-rx0)*k,bx1=(B.x1-rx0)*k,by0=(B.y0-ry0)*k,by1=(B.y1-ry0)*k,bwk=bx1-bx0,bhk=by1-by0;
  const S0=sobel(grayOf(C0),w,h);
  const t=estimateTilt(S0.gx,S0.gy,w,h,bx0-.3*bwk,bx1+.3*bwk,by0+.1*bhk,by1-.1*bhk,tHint);
  const tr=t*DEG,cs=Math.cos(tr),sn=Math.sin(tr),cx=w/2,cy=h/2;
  const rot=(p,s)=>[cs*(p[0]-cx)-s*sn*(p[1]-cy)+cx,s*sn*(p[0]-cx)+cs*(p[1]-cy)+cy];
  const C1=document.createElement('canvas');C1.width=w;C1.height=h;const c1=C1.getContext('2d');c1.fillStyle='#000';c1.fillRect(0,0,w,h);c1.translate(cx,cy);c1.rotate(tr);c1.drawImage(C0,-cx,-cy);
  const M=edgeMaps20(C1);
  const bc=rot([(bx0+bx1)/2,(by0+by1)/2],1),as=Math.abs(sn);
  const wT=Math.max(.35*bwk,(bwk-bhk*as)/Math.max(.5,cs)),hT=Math.max(.6*bhk,(bhk-wT*as)/Math.max(.5,cs));
  const ya=clamp(bc[1]-.42*hT,1,h-2),yb=clamp(bc[1]+.42*hT,ya+2,h-1);
  const eL=bc[0]-wT/2,eR=bc[0]+wT/2,span=(local?.32:.6)*wT+2;
  const S=vConsistency20(M,ya,yb,10,eL-span-3,eR+span+3);
  const peaks=(lo,hi,e)=>{const out=[];for(let x=Math.max(2,Math.round(lo));x<=Math.min(w-3,Math.round(hi));x++)if(S[x]>=S[x-1]&&S[x]>=S[x+1]&&S[x]>.15)out.push({x,v:S[x]*(1-.3*Math.min(1,Math.abs(x-e)/span))});out.sort((a,b)=>b.v-a.v);return out.slice(0,8);};
  const cl=peaks(eL-span,bc[0]-.12*wT,eL),cr=peaks(bc[0]+.12*wT,eR+span,eR);
  let L=eL,R=eR,best=-1;const wmin=(local?.6:.4)*wT,wmax=(local?1.4:1.6)*wT;
  for(const a of cl.length?cl:[{x:eL,v:0}])for(const b of cr.length?cr:[{x:eR,v:0}]){const ww=b.x-a.x;if(ww<wmin||ww>wmax)continue;let inner=0;const m=Math.max(2,Math.round(.12*ww));for(let x=a.x+m;x<=b.x-m;x++)inner=Math.max(inner,S[x]);const v=a.v+b.v-.9*Math.max(0,inner-.35*Math.min(a.v,b.v));if(v>best){best=v;L=a.x;R=b.x;}}
  const win=Math.max(2,.08*(R-L)),yA=clamp(bc[1]-.46*hT,1,h-2),yB=clamp(bc[1]+.46*hT,yA+2,h-1);
  const fL=fitEdge20(M,L,yA,yB,win),fR=fitEdge20(M,R,yA,yB,win);
  let xL=fL.at,xR=fR.at;if(!(xR(bc[1])-xL(bc[1])>wmin*.85)){xL=()=>L;xR=()=>R;}
  const s=Math.max(2,Math.round(.02*hT)),eT=bc[1]-hT/2,eB=bc[1]+hT/2,wy=(local?.08:.16)*hT;
  const Qy=y=>{let q=0,n=0;const a=Math.round(xL(y)),b=Math.round(xR(y)),m=Math.ceil((b-a)*.15);for(let x=a+m;x<=b-m;x++){if(x<1||x>=w-1)continue;q+=M.ey[y*w+x];n++;}return n?q/n:0;};
  const pickY=(lo,hi,e)=>{let by=e,bv=-1;const vals=[];for(let y=Math.max(s+1,Math.round(lo));y<=Math.min(h-s-2,Math.round(hi));y++)vals.push([y,hStep20(M,xL,xR,y,s)+.15*Qy(y)]);const mxv=Math.max(1,...vals.map(v=>v[1]));vals.forEach(([y,v])=>{const sc=v/mxv*(1-.35*Math.abs(y-e)/Math.max(1,wy));if(sc>bv){bv=sc;by=y;}});return {y:by,v:mxv};};
  const pt=pickY(eT-(local?.06*hT:wy),eT+(local?.05*hT:wy),eT),pb=pickY(eB-(local?.1*hT:wy),eB+(local?.04:.1)*hT,eB);
  let T=pt.v>14?pt.y:eT,Bt=pb.v>14?pb.y:eB;if(Bt-T<.72*hT||Bt-T>1.3*hT){T=eT;Bt=eB;}
  const dx=.006*(R-L)+.35,dy=.002*(Bt-T);
  const quad=[[xL(T)+dx,T+dy],[xR(T)-dx,T+dy],[xR(Bt)-dx,Bt-dy],[xL(Bt)+dx,Bt-dy]].map(p=>{const q=rot(p,-1);return [rx0+q[0]/k,ry0+q[1]/k];});
  return {quad,tilt:t,edges:[fL.ok,fR.ok]};
}
/* découpe du scan : affine chaque tranche localement (bords, haut et bas) */
function refineScanQuad20(img,Q){
  try{const B=quadBox(Q),dy=((Q[3][1]-Q[0][1])+(Q[2][1]-Q[1][1]))/2,dx=((Q[3][0]-Q[0][0])+(Q[2][0]-Q[1][0]))/2;
    const tHint=dy>0?clamp(Math.atan(dx/dy)/DEG,-25,25):null,r=autoQuad20(img,B,tHint,{local:true}),q=r.quad;
    const wOld=(Math.hypot(Q[1][0]-Q[0][0],Q[1][1]-Q[0][1])+Math.hypot(Q[2][0]-Q[3][0],Q[2][1]-Q[3][1]))/2,wNew=(Math.hypot(q[1][0]-q[0][0],q[1][1]-q[0][1])+Math.hypot(q[2][0]-q[3][0],q[2][1]-q[3][1]))/2;
    const hOld=Math.abs(dy),hNew=((q[3][1]-q[0][1])+(q[2][1]-q[1][1]))/2;
    if(!(wNew>.6*wOld&&wNew<1.4*wOld&&hNew>.8*hOld&&hNew<1.06*hOld))return Q;return q;}catch(e){console.warn('SCANEBOOK V2.20 affinage',e);return Q;}
}

/* =====================================================================
   SCANEBOOK V2.20 – fiche ouvrage réorganisée, réglage fin commun (détourage
   et couverture), localisation du livre dans la pièce, étagères, types.
   ===================================================================== */
const FICHE_SEC20 = (() => { try { return JSON.parse(localStorage.getItem('scanly_fiche_sections') || '{}'); } catch (e) { return {}; } })();
function ficheSecOpen20(key, def) { return key in FICHE_SEC20 ? !!FICHE_SEC20[key] : def; }
function bindFiche20(b, isNew) {
  $$('#dBody details.fsec20').forEach(d => d.addEventListener('toggle', () => { if (d.dataset.sec === 'loan') return; FICHE_SEC20[d.dataset.sec] = d.open; localStorage.setItem('scanly_fiche_sections', JSON.stringify(FICHE_SEC20)); }));
  const t = $('#bTypes20'); if (t) t.onclick = e => { e.preventDefault(); openTypes20(); };
  $('#dBody').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); $('#bSave')?.click(); } }); // PC : Ctrl+Entrée, Mac : ⌘+Entrée
  const sel = $('#eType'); if (sel) sel.addEventListener('change', async () => { if (sel.value !== '__newType') return; const n = (prompt('Nom du nouveau type de livre :', '') || '').trim(); if (!n) { sel.value = b.type || 'Autre'; return; } addType20(n); sel.innerHTML = typeOptions20(n); bookDirty = true; });
}

/* ---------- Types de livre modifiables ---------- */
function ensureTypes20() {
  for (const b of books) if (b.type && !TYPES.includes(b.type)) { const i = TYPES.indexOf('Autre'); TYPES.splice(i < 0 ? TYPES.length : i, 0, b.type); }
  if (!TYPES.includes('Autre')) TYPES.push('Autre');
}
/* loadTypes20() est dans js/01_base.js (appelée dès le chargement) */
function saveTypes20() { localStorage.setItem('scanly_types', JSON.stringify(TYPES)); try { SY.dirty = true; } catch (e) {} }
function addType20(n) { if (!TYPES.includes(n)) { const i = TYPES.indexOf('Autre'); TYPES.splice(i < 0 ? TYPES.length : i, 0, n); saveTypes20(); } }
function typeOptions20(cur) { ensureTypes20(); const list = cur && !TYPES.includes(cur) ? [...TYPES, cur] : TYPES; return list.map(t => `<option value="${esc(t)}" ${cur === t ? 'selected' : ''}>${esc(t)}</option>`).join('') + '<option value="__newType">＋ Nouveau type…</option>'; }
function applyTypesSetting20(list) { if (!Array.isArray(list) || !list.length) return; TYPES.splice(0, TYPES.length, ...[...new Set(list.filter(s => typeof s === 'string' && s.trim()))]); if (!TYPES.includes('Autre')) TYPES.push('Autre'); localStorage.setItem('scanly_types', JSON.stringify(TYPES)); }
async function renameType20(from, to) {
  to = String(to || '').trim(); if (!to || to === from) return false;
  const L = books.filter(b => b.type === from), merge = TYPES.includes(to);
  if (!confirm(`${merge ? 'Fusionner' : 'Renommer'} « ${from} » en « ${to} » ?\n${L.length} livre(s) concerné(s), y compris les souhaits. Les autres informations ne changent pas.`)) return false;
  if (L.length && !await safetyPoint18('Avant changement de type')) return false;
  L.forEach(b => { b.type = to; b.updatedAt = Date.now(); }); if (L.length) await DB.putMany('books', L);
  const i = TYPES.indexOf(from); if (merge) { if (i >= 0) TYPES.splice(i, 1); } else if (i >= 0) TYPES[i] = to; else addType20(to);
  if (F.type === from) F.type = to; saveTypes20(); renderAll(); toast(`${L.length} livre(s) : type « ${to} »`); return true;
}
async function deleteType20(name) {
  const L = books.filter(b => b.type === name); if (name === 'Autre') return toast('Le type « Autre » est conservé');
  if (!confirm(`Supprimer le type « ${name} » ?${L.length ? `\n${L.length} livre(s) passeront en « Autre ».` : ''}`)) return;
  if (L.length) { if (!await safetyPoint18('Avant suppression de type')) return; L.forEach(b => { b.type = 'Autre'; b.updatedAt = Date.now(); }); await DB.putMany('books', L); }
  const i = TYPES.indexOf(name); if (i >= 0) TYPES.splice(i, 1); if (F.type === name) F.type = ''; saveTypes20(); renderAll(); openTypes20();
}
function openTypes20() {
  ensureTypes20(); const fromFiche = $('#drawer').classList.contains('on') && $('#eType');
  const count = t => books.filter(b => b.type === t).length;
  const html = () => `<div class="dhead"><h3>Types de livre</h3><button class="x" data-close>×</button></div><div class="mbody"><p class="hint">Renommer un type change l’intitulé de tous les livres concernés. Choisir un nom déjà existant fusionne les deux types. Un point de restauration est créé avant la modification.</p>
    <table class="mini types20" data-no-i18n>${TYPES.map((t, i) => `<tr><td><input class="fld" data-type-name="${i}" value="${esc(t)}" aria-label="Nom du type"></td><td class="hint">${count(t)} livre(s)</td><td style="white-space:nowrap"><button type="button" class="btn s sm" data-type-ren="${i}">Renommer</button>${t !== 'Autre' ? `<button type="button" class="btn k sm" data-type-del="${i}" aria-label="Supprimer le type">✕</button>` : ''}</td></tr>`).join('')}</table>
    <div class="btns"><input class="fld" id="typeNew20" placeholder="Nouveau type" style="flex:1;min-width:160px"><button type="button" class="btn g" id="typeAdd20">Ajouter</button></div></div>`;
  openModal(html(), 'sm');
  const root = $('#mbox');
  root.onclick = async e => { const r = e.target.closest('[data-type-ren]'), d = e.target.closest('[data-type-del]');
    if (r) { const i = +r.dataset.typeRen, from = TYPES[i], to = $(`[data-type-name="${i}"]`).value; if (await renameType20(from, to)) { openTypes20(); refreshTypeSelect20(); } }
    if (d) { await deleteType20(TYPES[+d.dataset.typeDel]); refreshTypeSelect20(); } };
  $('#typeAdd20').onclick = () => { const n = $('#typeNew20').value.trim(); if (!n) return; addType20(n); openTypes20(); refreshTypeSelect20(); };
  function refreshTypeSelect20() { const s = fromFiche && $('#eType'); if (s) { const cur = TYPES.includes(s.value) ? s.value : (books.find(b => b.id === NAV.cur)?.type || 'Autre'); s.innerHTML = typeOptions20(cur); } }
}

/* ---------- Voir dans la pièce : zoom + mise en évidence ---------- */
function locateBook20(id) {
  const el = $(`#unit .book[data-id="${id}"]`); if (!el) return toast('Livre non visible dans la pièce (filtre ou meuble masqué)');
  const b = stageBox([el]), bh = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, half = Math.max(bh * 1.15, (b.x1 - b.x0) * 4);
  zoomToBox({x0: cx - half, x1: cx + half, y0: b.y0 - bh * .35, y1: b.y1 + bh * .25}, .92, .86);
  $$('#unit .locate20').forEach(x => x.classList.remove('locate20')); $$('#unit .locpin20').forEach(x => x.remove());
  el.classList.add('locate20', 'hit');
  const pin = document.createElement('div'); pin.className = 'locpin20'; pin.setAttribute('aria-hidden', 'true'); pin.textContent = '▼';
  pin.style.left = (parseFloat(el.style.left) + parseFloat(el.style.width) / 2) + 'px'; pin.style.top = (parseFloat(el.style.top) - 46) + 'px'; $('#unit').appendChild(pin);
  const bk = books.find(x => x.id === id); toast(`« ${bk ? dispTitle(bk) : ''} » ${IS_TOUCH ? '– Vue › « Tout voir » pour revenir' : '– Échap ou « Tout voir » pour revenir'}`, 4000);
  clearTimeout(window._loc20); window._loc20 = setTimeout(() => { el.classList.remove('locate20', 'hit'); pin.remove(); }, 6500);
}

/* ---------- Étagère : menu (clic sur ⇕) et suppression ---------- */
function openShelves21() {
  const c = cases.find(x => x.id === curCase); if (!c) return toast('Choisis d’abord un meuble');
  const n = rowsCount({...c, bs: books.filter(b => b.caseId === c.id)});
  openModal(`<div class="dhead"><h3 data-no-i18n>Étagères – ${esc(c.name)}</h3><button class="x" data-close>×</button></div><div class="mbody"><p class="hint">Choisis l’étagère (1 = en haut).</p><div class="shelfmenu20">${Array.from({length: n}, (_, i) => { const k = books.filter(b => b.caseId === c.id && (b.row || 1) === i + 1 && !b.wish).length; return `<button type="button" class="btn s" data-sh21="${i + 1}">Étagère ${i + 1} · ${k} livre${k > 1 ? 's' : ''}</button>`; }).join('')}</div></div>`, 'sm');
  $('#mbox').onclick = e => { const t = e.target.closest('[data-sh21]'); if (t) { closeModal(); openShelfMenu20(c.id + '|' + t.dataset.sh21); } };
}
function openShelfMenu20(key) {
  const i = key.lastIndexOf('|'), cid = key.slice(0, i), row = +key.slice(i + 1), c = cases.find(x => x.id === cid); if (!c) return;
  const L = books.filter(b => caseOf(b) === cid && (b.row || 1) === row && !b.wish), W = books.filter(b => caseOf(b) === cid && (b.row || 1) === row && b.wish);
  openModal(`<div class="dhead"><h3 data-no-i18n>Étagère ${row} – ${esc(c.name)}</h3><button class="x" data-close>×</button></div><div class="mbody">
    <p class="hint">${L.length} livre(s) sur cette étagère${W.length ? ` et ${W.length} souhait(s) affiché(s) en fantôme (non supprimés)` : ''}. Pour déplacer l’étagère : maintenir ⇕ puis glisser vers le haut, le bas ou l’onglet d’un autre meuble.</p>
    <div class="shelfmenu20"><button type="button" class="btn s" id="shSel20">☑ Sélectionner ces livres</button>
    <button type="button" class="btn k" id="shEmpty20" ${L.length ? '' : 'disabled'}>Supprimer les livres de l’étagère</button>
    <button type="button" class="btn k" id="shDel20">Supprimer l’étagère</button></div>
    <p class="hint">« Supprimer l’étagère » met ses livres dans la corbeille (restaurables 30 jours) et fait remonter les étagères du dessous. Un point de restauration est créé avant.</p></div>`, 'sm');
  $('#shSel20').onclick = () => { closeModal(); CAM.sel = true; L.forEach(b => SEL.add(b.id)); renderRoom(); renderList(); };
  $('#shEmpty20').onclick = async () => { closeModal(); await deleteBooks(L.map(b => b.id), `Étagère ${row} vidée`); };
  $('#shDel20').onclick = async () => { closeModal(); await deleteShelf20(cid, row); };
}
async function deleteShelf20(cid, row) {
  const c = cases.find(x => x.id === cid); if (!c) return;
  const L = books.filter(b => caseOf(b) === cid && (b.row || 1) === row && !b.wish), W = books.filter(b => caseOf(b) === cid && (b.row || 1) === row && b.wish);
  if (!confirm(`Supprimer l’étagère ${row} de « ${c.name} » ?${L.length ? `\n${L.length} livre(s) iront dans la corbeille (restaurables).` : ''}\nLes étagères du dessous remonteront d’un cran.`)) return;
  if (!await safetyPoint18('Avant suppression d’étagère')) return;
  const batch = 'del_' + uid(), now = Date.now(), ids = new Set(L.map(b => b.id));
  if (L.length) { await DB.putMany('trash', L.map(b => ({...b, trashBatch: batch, deletedAt: now, trashLabel: `Étagère ${row} – ${c.name}`}))); await DB.delMany('books', [...ids]); books = books.filter(b => !ids.has(b.id)); L.forEach(b => SEL.delete(b.id)); }
  const below = books.filter(b => caseOf(b) === cid && (b.row || 1) > row); below.forEach(b => b.row = (b.row || 1) - 1);
  W.forEach(b => { b.row = Math.max(1, row - (row > 1 ? 1 : 0)); }); const moved = [...below, ...W]; if (moved.length) await DB.putMany('books', moved);
  const oldRows = c.rows || 3; c.rows = Math.max(1, oldRows - 1); await DB.put('cases', c);
  renderAll();
  showUndo(`Étagère ${row} supprimée${L.length ? ` (${L.length} livre(s) en corbeille)` : ''}`, async () => {
    books.filter(b => caseOf(b) === cid && (b.row || 1) >= row && !W.includes(b)).forEach(b => b.row = (b.row || 1) + 1); W.forEach(b => b.row = row);
    await DB.putMany('books', books.filter(b => caseOf(b) === cid)); c.rows = oldRows; await DB.put('cases', c); if (L.length) await restoreTrash(batch); else renderAll(); });
}

/* ---------- Réglage fin partagé : détourage, couverture, zone ---------- */
function fineToolbar20() {
  return `<div class="fe20-tools" role="group" aria-label="Réglage fin"><button type="button" class="btn s sm" data-fe="out" aria-label="Zoom arrière" title="Zoom arrière">−</button><button type="button" class="btn s sm" data-fe="in" aria-label="Zoom avant" title="Zoom avant">＋</button><button type="button" class="btn s sm" data-fe="fit">Ajuster la vue</button><span class="fe20-pad"><button type="button" class="btn s sm" data-fe="corner" title="Choisir le coin à régler">Coin suivant</button><button type="button" class="btn s sm" data-fe="l" aria-label="Gauche" title="Déplacer le coin choisi">←</button><button type="button" class="btn s sm" data-fe="u" aria-label="Haut" title="Déplacer le coin choisi">↑</button><button type="button" class="btn s sm" data-fe="d" aria-label="Bas" title="Déplacer le coin choisi">↓</button><button type="button" class="btn s sm" data-fe="r" aria-label="Droite" title="Déplacer le coin choisi">→</button></span><span class="hint fe20-info" aria-live="polite"></span></div>`;
}
function bindFineToolbar20(root, ed, fitBox) {
  const info = root.querySelector('.fe20-info'); ed.onInfo = t => { if (info) info.textContent = t; }; ed.info();
  root.querySelectorAll('[data-fe]').forEach(btn => {
    const k = btn.dataset.fe, act = () => ({in: () => ed.zoomBy(1.4), out: () => ed.zoomBy(1 / 1.4), fit: () => ed.fit(ed.polyBox(.25)), corner: () => ed.nextCorner(), l: () => ed.nudge(-1, 0), r: () => ed.nudge(1, 0), u: () => ed.nudge(0, -1), d: () => ed.nudge(0, 1)})[k]?.();
    if ('lrud'.includes(k) && k.length === 1) { let t1 = 0, t2 = 0; const stop = () => { clearTimeout(t1); clearInterval(t2); };
      btn.addEventListener('pointerdown', e => { e.preventDefault(); act(); t1 = setTimeout(() => { t2 = setInterval(act, 55); }, 380); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop)); btn.addEventListener('click', e => e.preventDefault());
      btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }); }
    else btn.onclick = act;
  });
}
function fineEditor20({area, source, Q, mode = 'quad', onChange = () => {}}) {
  const cv = document.createElement('canvas'); cv.className = 'fe20-canvas'; cv.tabIndex = 0; cv.setAttribute('role', 'application');
  cv.setAttribute('aria-label', 'Zone de réglage : glisser les coins ou les bords ; flèches = ajuster le coin sélectionné'); area.appendChild(cv);
  const ctx = cv.getContext('2d'), coarse = matchMedia('(pointer:coarse)').matches, HR = coarse ? 30 : 16, CR = coarse ? 11 : 7;
  let src = source, SW = imgW(src), SH = imgH(src), z = 1, ox = 0, oy = 0, sel = 0, act = null, drawMode = false, raf = 0, alive = true, fitted = false;
  Q = Q.map(p => [p[0], p[1]]);
  const ptrs = new Map(); let pinch = null;
  const S = p => [p[0] * z + ox, p[1] * z + oy], I = (sx, sy) => [(sx - ox) / z, (sy - oy) / z];
  const dims = () => { const r = area.getBoundingClientRect(); return {w: Math.max(1, r.width), h: Math.max(1, r.height)}; };
  const clampP = p => [clamp(p[0], 0, SW), clamp(p[1], 0, SH)];
  const rectFrom = (a, b) => { const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]); return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; };
  const inside = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < (P[j][0] - P[i][0]) * (p[1] - P[i][1]) / (P[j][1] - P[i][1] + 1e-9) + P[i][0]) c = !c; return c; };
  const req = () => { if (!raf) raf = requestAnimationFrame(render); };
  const api = {onInfo: null};
  const emit = () => { onChange(Q.map(p => [p[0], p[1]])); api.info(); req(); };
  function render() {
    raf = 0; if (!alive || !cv.isConnected) return; const {w, h} = dims(), d = devicePixelRatio || 1;
    if (!fitted) { api.fit(polyBox(.3)); fitted = true; }
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.fillStyle = '#0d1626'; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = z < 3; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, ox, oy, SW * z, SH * z);
    const V = Q.map(S);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.moveTo(V[0][0], V[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(V[i][0], V[i][1]); ctx.closePath(); ctx.fill('evenodd');
    ctx.lineWidth = 2; ctx.strokeStyle = '#D4AF7C'; ctx.beginPath(); V.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke();
    for (let i = 0; i < 4; i++) { const a = V[i], b = V[(i + 1) % 4], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], s = coarse ? 7 : 5; ctx.fillStyle = act && act.t === 'edge' && act.k === i ? '#fff' : '#D4AF7C'; ctx.strokeStyle = '#0B1F44'; ctx.lineWidth = 1.5; ctx.fillRect(m[0] - s, m[1] - s, 2 * s, 2 * s); ctx.strokeRect(m[0] - s, m[1] - s, 2 * s, 2 * s); }
    V.forEach((p, i) => { ctx.beginPath(); ctx.arc(p[0], p[1], CR, 0, Math.PI * 2); ctx.fillStyle = i === sel ? '#ffffff' : '#D4AF7C'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#0B1F44'; ctx.stroke(); ctx.fillStyle = '#0B1F44'; ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2); });
    if (act && (act.t === 'corner' || act.t === 'edge')) loupe(act.t === 'corner' ? Q[act.k] : [(Q[act.k][0] + Q[(act.k + 1) % 4][0]) / 2, (Q[act.k][1] + Q[(act.k + 1) % 4][1]) / 2], act.sp);
  }
  function loupe(pt, at) {
    const {w, h} = dims(), R = Math.max(46, Math.min(78, Math.min(w, h) * .2)), Z = Math.max(z * 3.5, 1.5);
    const sp = at || S(pt), cx = sp[0] < w / 2 ? w - R - 10 : R + 10, cy = sp[1] < h / 2 && sp[0] > w / 2 - R && sp[0] < w / 2 + R ? h - R - 10 : R + 10;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = '#000'; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.imageSmoothingEnabled = Z < 3; ctx.drawImage(src, cx - pt[0] * Z, cy - pt[1] * Z, SW * Z, SH * Z);
    ctx.strokeStyle = 'rgba(212,175,124,.95)'; ctx.lineWidth = 1.5; ctx.beginPath(); Q.forEach((p, i) => { const x = cx + (p[0] - pt[0]) * Z, y = cy + (p[1] - pt[1]) * Z; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx - 5, cy); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy - 5); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + R); ctx.stroke();
    ctx.restore(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#D4AF7C'; ctx.stroke();
  }
  function polyBox(m = 0) { const B = quadBox(Q), bw = B.x1 - B.x0, bh = B.y1 - B.y0, mm = Math.max(bw, bh) * m; return {x0: B.x0 - Math.max(mm, bw * .6), y0: B.y0 - mm * .4, x1: B.x1 + Math.max(mm, bw * .6), y1: B.y1 + mm * .4}; }
  function setCorner(k, p) { p = clampP(p); if (mode === 'rect') { Q = rectFrom(p, Q[(k + 2) % 4]); let best = 0, bd = 1e18; Q.forEach((q, i) => { const dd = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (dd < bd) { bd = dd; best = i; } }); sel = best; if (act && act.t === 'corner') act.k = best; } else Q[k] = p; }
  function hit(sx, sy) {
    const V = Q.map(S); let k = -1, bd = HR * HR; V.forEach((p, i) => { const dd = (p[0] - sx) ** 2 + (p[1] - sy) ** 2; if (dd < bd) { bd = dd; k = i; } }); if (k >= 0) return {t: 'corner', k};
    for (let i = 0; i < 4; i++) { const a = V[i], b = V[(i + 1) % 4], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if ((m[0] - sx) ** 2 + (m[1] - sy) ** 2 < HR * HR) return {t: 'edge', k: i}; }
    if (!drawMode && inside([sx, sy], V)) return {t: 'move'};
    return drawMode ? {t: 'new'} : {t: 'pan'};
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); cv.focus({preventScroll: true}); try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    const sp = pos(e); ptrs.set(e.pointerId, sp);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = {d: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]}; act = null; req(); return; }
    const h = hit(sp[0], sp[1]), ip = I(sp[0], sp[1]);
    if (h.t === 'corner') { sel = h.k; act = {t: 'corner', k: h.k, off: [Q[h.k][0] - ip[0], Q[h.k][1] - ip[1]], sp}; }
    else if (h.t === 'edge') act = {t: 'edge', k: h.k, start: ip, Q0: Q.map(p => [...p]), sp};
    else if (h.t === 'move') act = {t: 'move', start: ip, Q0: Q.map(p => [...p])};
    else if (h.t === 'new') act = {t: 'new', start: clampP(ip)};
    else act = {t: 'pan', sp, ox, oy};
    req(); api.info();
  });
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) { const sp = pos(e), h = hit(sp[0], sp[1]); cv.style.cursor = h.t === 'corner' ? 'crosshair' : h.t === 'edge' ? 'move' : h.t === 'move' ? 'grab' : h.t === 'new' ? 'crosshair' : 'grab'; return; }
    const sp = pos(e); ptrs.set(e.pointerId, sp);
    if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()], d = Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; zoomAt(d / pinch.d, m); ox += m[0] - pinch.m[0]; oy += m[1] - pinch.m[1]; pinch = {d, m}; req(); return; }
    if (!act) return; const ip = I(sp[0], sp[1]);
    if (act.t === 'pan') { ox = act.ox + sp[0] - act.sp[0]; oy = act.oy + sp[1] - act.sp[1]; req(); return; }
    act.sp = sp;
    if (act.t === 'corner') setCorner(act.k, [ip[0] + act.off[0], ip[1] + act.off[1]]);
    else if (act.t === 'edge') { const dx = ip[0] - act.start[0], dy = ip[1] - act.start[1], k = act.k, j = (k + 1) % 4; Q = act.Q0.map(p => [...p]);
      if (mode === 'rect') { const B = quadBox(act.Q0); if (k === 0) B.y0 = clamp(B.y0 + dy, 0, B.y1 - 2); if (k === 1) B.x1 = clamp(B.x1 + dx, B.x0 + 2, SW); if (k === 2) B.y1 = clamp(B.y1 + dy, B.y0 + 2, SH); if (k === 3) B.x0 = clamp(B.x0 + dx, 0, B.x1 - 2); Q = rectFrom([B.x0, B.y0], [B.x1, B.y1]); }
      else { Q[k] = clampP([act.Q0[k][0] + dx, act.Q0[k][1] + dy]); Q[j] = clampP([act.Q0[j][0] + dx, act.Q0[j][1] + dy]); } }
    else if (act.t === 'move') { const B = quadBox(act.Q0); const dx = clamp(ip[0] - act.start[0], -B.x0, SW - B.x1), dy = clamp(ip[1] - act.start[1], -B.y0, SH - B.y1); Q = act.Q0.map(p => [p[0] + dx, p[1] + dy]); }
    else if (act.t === 'new') { const p = clampP(ip); if (Math.abs(p[0] - act.start[0]) > 2 && Math.abs(p[1] - act.start[1]) > 2) Q = rectFrom(act.start, p); }
    emit();
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) { act = null; req(); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * .0015), pos(e)); }, {passive: false});
  cv.addEventListener('dblclick', e => { e.preventDefault(); zoomAt(2, pos(e)); });
  function zoomAt(f, p) { const nz = clamp(z * f, .02, 40); ox = p[0] - (p[0] - ox) * nz / z; oy = p[1] - (p[1] - oy) * nz / z; z = nz; api.info(); req(); }
  /* flèches : actives quand la photo a le focus (clic dessus) ; sinon elles gardent leur rôle (livre précédent / suivant) */
  const key = e => { if (!alive || document.activeElement !== cv) return; const m = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
    if (m) { e.preventDefault(); e.stopImmediatePropagation(); api.nudge(m[0] * (e.shiftKey ? 10 : 1), m[1] * (e.shiftKey ? 10 : 1)); }
    else if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) { e.preventDefault(); e.stopImmediatePropagation(); api.nextCorner(e.shiftKey ? -1 : 1); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); api.zoomBy(1.4); } else if (e.key === '-') { e.preventDefault(); api.zoomBy(1 / 1.4); } };
  window.addEventListener('keydown', key, true);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => req()) : null; ro?.observe(area);
  Object.assign(api, {
    get Q() { return Q.map(p => [p[0], p[1]]); },
    setQ(q) { Q = q.map(p => clampP(p)); api.info(); req(); },
    setSource(s, q) { src = s; SW = imgW(s); SH = imgH(s); Q = q.map(p => clampP(p)); req(); },
    fit(B) { const {w, h} = dims(), bw = Math.max(4, B.x1 - B.x0), bh = Math.max(4, B.y1 - B.y0); z = clamp(Math.min(w / bw, h / bh) * .94, .02, 40); ox = w / 2 - (B.x0 + bw / 2) * z; oy = h / 2 - (B.y0 + bh / 2) * z; fitted = true; api.info(); req(); },
    zoomBy(f) { const {w, h} = dims(); zoomAt(f, [w / 2, h / 2]); },
    nextCorner(d = 1) { sel = (sel + 4 + d) % 4; api.info(); req(); const p = S(Q[sel]), {w, h} = dims(); if (p[0] < 0 || p[1] < 0 || p[0] > w || p[1] > h) { ox += w / 2 - p[0]; oy += h / 2 - p[1]; } },
    nudge(dx, dy) { const step = Math.max(.5, 1 / z); setCorner(sel, [Q[sel][0] + dx * step, Q[sel][1] + dy * step]); act = {t: 'corner', k: sel, off: [0, 0], sp: null}; emit(); clearTimeout(api._nt); api._nt = setTimeout(() => { if (act && !ptrs.size) { act = null; req(); } }, 900); },
    toggleDraw() { drawMode = !drawMode; return drawMode; },
    polyBox,
    info() { const names = ['haut gauche', 'haut droit', 'bas droit', 'bas gauche']; api.onInfo?.(`Coin sélectionné : ${names[sel]} · zoom ${Math.round(z * 100)} %`); },
    destroy() { alive = false; window.removeEventListener('keydown', key, true); ro?.disconnect(); if (raf) cancelAnimationFrame(raf); }
  });
  req();
  return api;
}
/* couverture : recherche des 4 bords dominants (droites) autour du centre de la photo */
function coverGuess20(full, auto = false) {
  const W = imgW(full), H = imgH(full), whole = [[0, 0], [W, 0], [W, H], [0, H]]; if (!auto) return whole;
  try {
    const k = Math.min(1, 420 / Math.max(W, H)), w = Math.max(16, Math.round(W * k)), h = Math.max(16, Math.round(H * k)), c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(full, 0, 0, w, h);
    const M = edgeMaps20(c), angles = []; for (let a = -10; a <= 10; a += 1) angles.push(Math.tan(a * DEG));
    const line = (vertical, lo, hi, prefOuter) => { let best = null; const n = vertical ? h : w, m = vertical ? w : h, E = vertical ? M.ex : M.ey;
      for (const t of angles) for (let o = Math.max(2, Math.round(lo)); o <= Math.min(m - 3, Math.round(hi)); o++) { const seg = 8, sums = new Float32Array(seg);
        for (let s = Math.round(n * .04); s < n * .96; s += 2) { const q = Math.round(o + (s - n / 2) * t); if (q < 1 || q >= m - 1) continue; sums[Math.min(seg - 1, Math.floor(s / n * seg))] += vertical ? E[s * w + q] : E[q * w + s]; }
        const srt = Array.from(sums).sort((a, b) => a - b), v = (srt[2] + srt[3] + srt[4]) / 3 * (1 + .35 * Math.abs(o - m / 2) / (m / 2) * prefOuter);
        if (!best || v > best.v) best = {o, t, v}; }
      return best; };
    const L = line(true, 0, w * .45, 1), R = line(true, w * .55, w, 1), T = line(false, 0, h * .45, 1), B = line(false, h * .55, h, 1);
    if (![L, R, T, B].every(Boolean)) return whole;
    const meet = (V, Hh) => { /* x = V.o + (y - h/2)·V.t ; y = H.o + (x - w/2)·H.t */ let x = V.o, y = Hh.o; for (let i = 0; i < 6; i++) { y = Hh.o + (x - w / 2) * Hh.t; x = V.o + (y - h / 2) * V.t; } return [clamp(x / k, 0, W), clamp(y / k, 0, H)]; };
    const q = [meet(L, T), meet(R, T), meet(R, B), meet(L, B)], area = Math.abs(q.reduce((s, p, i) => { const n2 = q[(i + 1) % 4]; return s + p[0] * n2[1] - n2[0] * p[1]; }, 0)) / 2;
    return area > W * H * .12 ? q : whole;
  } catch (e) { console.warn('SCANEBOOK couverture', e); return whole; }
}

