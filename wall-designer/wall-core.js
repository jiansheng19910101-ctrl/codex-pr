// Geometry, SVG, DXF and drag interaction adapted from upstream commit fea0bde55b72b191e867de5cac67f3e73f1e0029.

'use strict';
const defaults={river:10,frontSlope:2,platform:12,platformWidth:2,height:3,baseWidth:3.5,backSlope:2,crest:16,baseBottom:10.5,baseThickness:.5,wallTop:14,backStart:13.5,topThickness:.3,rootThickness:.5,toe:1,stoneTop:.8,faceSlope:.2,rearSlope:.2,frontExtension:.3,rearExtension:.3,crestWidth:3,riverWidth:3};
let state={...defaults},mode='simple',type='rc',model=null;
let dragSession=null;
const $=id=>document.getElementById(id),fmt=n=>Number(n).toFixed(2);
const defs={river:['河底高程','m'],frontSlope:['墙前坡比 1∶m','m值'],platform:['墙前泥面平台高程','m'],platformWidth:['墙前泥面平台净宽','m'],height:['墙高（基础顶至墙顶）','m'],baseWidth:['底板 / 基础总宽','m'],backSlope:['墙后坡比 1∶m','m值'],crest:['堤顶高程','m'],baseBottom:['基础底高程','m'],baseThickness:['底板 / 基础厚度','m'],wallTop:['墙顶高程','m'],backStart:['墙后起坡点高程','m'],topThickness:['墙顶厚度','m'],rootThickness:['墙根厚度','m'],toe:['墙趾长度','m'],stoneTop:['墙顶宽度','m'],faceSlope:['墙面坡率 1∶m','m值'],rearSlope:['墙背坡率 1∶m','m值'],frontExtension:['基础前外伸','m'],rearExtension:['基础后外伸','m'],crestWidth:['堤顶展示宽度','m'],riverWidth:['河底展示宽度','m']};
function form(){
 $('simpleTab').classList.toggle('active',mode==='simple');$('detailTab').classList.toggle('active',mode==='detail');
 $('modeNote').textContent=mode==='simple'?'8 项参数实时联动，其余尺寸按默认规则取值。':'分别调整地形、墙体与基础，实时更新断面。';
 const groups=mode==='simple'?[['基本参数',['river','frontSlope','platform','platformWidth','height','baseWidth','backSlope','crest']]]:[['墙前与墙后地形',['river','frontSlope','platform','platformWidth','backStart','backSlope','crest']],['墙体与基础定位',['wallTop','baseBottom','baseThickness']], [type==='rc'?'钢混墙截面':'浆砌块石墙截面',type==='rc'?['baseWidth','topThickness','rootThickness','toe']:['stoneTop','faceSlope','rearSlope','frontExtension','rearExtension']],['图形展示范围',['crestWidth','riverWidth']]];
 $('fields').innerHTML=groups.map(([title,keys])=>'<div class="group">'+title+'</div>'+keys.map(k=>'<div class="field"><label for="p_'+k+'">'+defs[k][0]+'</label><div class="control"><input id="p_'+k+'" data-key="'+k+'" type="number" step="0.1" value="'+state[k]+'"><span class="unit">'+defs[k][1]+'</span></div></div>').join('')).join('');
 $('fields').querySelectorAll('input').forEach(el=>el.addEventListener('input',()=>{state[el.dataset.key]=el.value===''?NaN:Number(el.value);update()}));update();
}
function parameters(){let p={...state};if(mode==='simple'){
 p.baseThickness=.5;p.baseBottom=p.platform-1.5;p.wallTop=p.baseBottom+.5+p.height;p.backStart=p.wallTop-.5;p.crestWidth=3;p.riverWidth=3;
 p.topThickness=.3;p.rootThickness=.5;p.toe=(p.baseWidth-.5)/3;
 p.stoneTop=.6;p.frontExtension=.25;p.rearExtension=.25;
 p.faceSlope=p.rearSlope=(p.baseWidth-.5-.6)/(2*p.height);
 }else p.height=p.wallTop-p.baseBottom-p.baseThickness;return p;}
function geometry(p){
 const errors=[];for(const [k,v] of Object.entries(p))if(!Number.isFinite(v)||Math.abs(v)>100000)errors.push(defs[k][0]+'请输入有效数字（绝对值不超过100000）');
 if(errors.length)throw Error(errors.join('；'));
 const positive=['platformWidth','height','baseThickness','crestWidth','riverWidth','frontSlope','backSlope'];positive.push(...(type==='rc'?['baseWidth','topThickness','rootThickness']:['stoneTop']));
 positive.forEach(k=>{if(p[k]<=0)errors.push(defs[k][0]+'须大于 0')});
 if(p.platform<=p.river)errors.push('平台高程须高于河底高程');
 const z=p.baseBottom+p.baseThickness;
 if(p.platform<z-1e-8||p.platform>=p.wallTop)errors.push('平台高程须不低于基础顶且低于墙顶');
 if(p.backStart<z||p.backStart>p.wallTop)errors.push('墙后起坡点须在基础顶与墙顶之间');
 if(p.crest<p.backStart)errors.push('堤顶高程须不低于墙后起坡点');
 let body,base,frontX,backX,B;
 if(type==='rc'){
 if(p.rootThickness<p.topThickness)errors.push('墙根厚度须不小于墙顶厚度');if(p.toe<0||p.baseWidth-p.toe-p.rootThickness<0)errors.push('墙趾或墙踵长度不足，请增大底板宽');
 body=[[0,z],[p.rootThickness,z],[p.rootThickness,p.wallTop],[p.rootThickness-p.topThickness,p.wallTop]];B=p.baseWidth;base=[[-p.toe,p.baseBottom],[B-p.toe,p.baseBottom],[B-p.toe,z],[-p.toe,z]];
 frontX=(p.rootThickness-p.topThickness)*(p.platform-z)/p.height;backX=p.rootThickness;
 }else{
 ['faceSlope','rearSlope','frontExtension','rearExtension'].forEach(k=>{if(p[k]<0)errors.push(defs[k][0]+'不能小于 0')});
 const w=p.stoneTop+(p.faceSlope+p.rearSlope)*p.height;B=w+p.frontExtension+p.rearExtension;
 body=[[0,z],[w,z],[p.faceSlope*p.height+p.stoneTop,p.wallTop],[p.faceSlope*p.height,p.wallTop]];base=[[-p.frontExtension,p.baseBottom],[w+p.rearExtension,p.baseBottom],[w+p.rearExtension,z],[-p.frontExtension,z]];
 frontX=p.faceSlope*(p.platform-z);backX=w-p.rearSlope*(p.backStart-z);
 }
 if(errors.length)throw Error(errors.join('；'));
 const platformLeft=frontX-p.platformWidth,riverFoot=platformLeft-(p.platform-p.river)*p.frontSlope,crestX=backX+(p.crest-p.backStart)*p.backSlope;
 const front=[[riverFoot-p.riverWidth,p.river],[riverFoot,p.river],[platformLeft,p.platform],[frontX,p.platform]],back=[[backX,p.backStart],[crestX,p.crest],[crestX+p.crestWidth,p.crest]];
 return {p,body,base,front,back,B,z,area:((type==='rc'?p.topThickness:p.stoneTop)+(body[1][0]-body[0][0]))*p.height/2+B*p.baseThickness};
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(g){
 const {p,body,base,front,back}=g;const pts=[...body,...base,...front,...back],xs=pts.map(a=>a[0]),ys=pts.map(a=>a[1]);let xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys)-1.4,ymax=Math.max(...ys)+1.2;
 let scale=Math.min(940/(xmax-xmin),430/(ymax-ymin)),ox=(1100-(xmax-xmin)*scale)/2,oy=90+(430-(ymax-ymin)*scale)/2;
 if(dragSession){({scale,ox,oy,xmin,ymax}=dragSession.view);}
 g.view={scale,ox,oy,xmin,ymax};
 const xy=a=>[ox+(a[0]-xmin)*scale,oy+(ymax-a[1])*scale],str=a=>a.map(v=>xy(v).join(',')).join(' ');
 let svg='<defs><pattern id="soil" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M0 15L15 0" stroke="#d6cabb" stroke-width=".7"/></pattern><pattern id="rc" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r=".8" fill="#8396aa"/></pattern><pattern id="stone" width="32" height="20" patternUnits="userSpaceOnUse"><path d="M0 0H32V20H0ZM0 10H32M16 0V10M8 10V20M28 10V20" fill="none" stroke="#8693a1" stroke-width=".8"/></pattern></defs>';
 const text=(a,t,color='#35475d',size=13,anchor='middle')=>{let [x,y]=xy(a);svg+='<text x="'+x+'" y="'+y+'" fill="'+color+'" font-size="'+size+'" text-anchor="'+anchor+'">'+esc(t)+'</text>'};
 const poly=(a,fill,stroke='#35475d')=>{svg+='<polygon points="'+str(a)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.7"/>'};
 const line=(a,color='#9b866c',dash=false)=>{svg+='<polyline points="'+str(a)+'" fill="none" stroke="'+color+'" stroke-width="1.8"'+(dash?' stroke-dasharray="5 4"':'')+'/>'};
 poly([...front,[front.at(-1)[0],ymin],[front[0][0],ymin]],'url(#soil)','none');poly([...back,[back.at(-1)[0],ymin],[back[0][0],ymin]],'url(#soil)','none');
 poly(base,'#f3f6fa');poly(base,type==='rc'?'url(#rc)':'url(#stone)');poly(body,'#f3f6fa');poly(body,type==='rc'?'url(#rc)':'url(#stone)');line(front);line(back);
 const elev=(a,label,dx=0,dy=.3)=>text([a[0]+dx,a[1]+dy],'▽ '+fmt(a[1])+(label?' '+label:''),'#1762ca',13);
 elev(front[1],'河底',-.6);elev(front[2],'平台');elev(body[2],'墙顶',-.2,.55);elev(back[0],'起坡点',1.05,.25);elev(back[1],'堤顶');elev(base[0],'基础底',-1.15,-.25);
 text([(front[1][0]+front[2][0])/2,(p.river+p.platform)/2+.45],'1∶'+p.frontSlope,'#9b744a');text([(back[0][0]+back[1][0])/2,(p.backStart+p.crest)/2+.4],'1∶'+p.backSlope,'#9b744a');
 function dim(a,b,label){line([a,b],'#18846a');const tick=.10;[a,b].forEach(v=>line([[v[0],v[1]-tick],[v[0],v[1]+tick]],'#18846a'));text([(a[0]+b[0])/2,a[1]+.15],label,'#18846a');}
 dim([front[2][0],p.platform+.55],[front[3][0],p.platform+.55],fmt(p.platformWidth)+' 平台净宽');dim([base[0][0],p.baseBottom-.7],[base[1][0],p.baseBottom-.7],fmt(g.B)+' 基础总宽');
 svg+='<text x="40" y="40" fill="#20304b" font-size="20" font-weight="600">'+(type==='rc'?'钢筋混凝土挡墙 · 悬臂式':'浆砌块石挡墙 · 重力式')+'</text><text x="40" y="620" fill="#8b99aa" font-size="12">断面几何预览 · 单位 m · 按实际比例绘制</text>';

 const hX=Math.min(base[0][0],front[3][0])-.65, h0=xy([hX,g.z]),h1=xy([hX,p.wallTop]);
 const left=xy(base[0]),right=xy(base[1]),topA=xy(body[2]),topB=xy(body[3]);
 function dragNode(action,point,label,cursor){return '<g class="drag-target" data-drag="'+action+'" tabindex="0" role="slider" aria-label="'+label+'" aria-valuenow="'+fmt(action==='height'?p.height:g.B)+'" style="cursor:'+cursor+'"><title>'+label+'；拖动或使用方向键</title><circle cx="'+point[0]+'" cy="'+point[1]+'" r="17" fill="transparent"/><circle class="drag-handle" cx="'+point[0]+'" cy="'+point[1]+'" r="6"/><path d="'+(action==='height'?'M'+point[0]+','+(point[1]-12)+'v-6m-3 3 3-3 3 3M'+point[0]+','+(point[1]+12)+'v6m-3-3 3 3 3-3':'M'+(point[0]-12)+','+point[1]+'h-6m3-3-3 3 3 3M'+(point[0]+12)+','+point[1]+'h6m-3-3 3 3-3 3')+'" stroke="#1762ca" fill="none" stroke-width="1.2"/></g>';}
 function dragLine(action,a,b,label){return '<g class="drag-target" data-drag="'+action+'" tabindex="0" role="slider" aria-label="'+label+'" aria-valuenow="'+fmt(action==='height'?p.height:g.B)+'" style="cursor:'+(action==='height'?'ns-resize':'ew-resize')+'"><title>'+label+'</title><path class="drag-hit" d="M'+a.join(',')+'L'+b.join(',')+'"/><path class="drag-dim" d="M'+a.join(',')+'L'+b.join(',')+'"/></g>';}
 svg+=dragLine('height',h0,h1,'上下拖动：墙高 '+fmt(p.height)+' m');
 [h0,h1].forEach(a=>{svg+='<path class="drag-dim" d="M'+(a[0]-6)+','+a[1]+'h12"/>'});
 svg+='<text class="drag-label" x="'+(h0[0]-10)+'" y="'+((h0[1]+h1[1])/2)+'" text-anchor="end">墙高 '+fmt(p.height)+'</text>';
 svg+=dragNode('height',h1,'墙高 '+fmt(p.height)+' m','ns-resize')+dragNode('height',topA,'墙顶高程 '+fmt(p.wallTop)+' m','ns-resize')+dragNode('height',topB,'墙顶高程 '+fmt(p.wallTop)+' m','ns-resize');
 const widthY=Math.max(left[1],right[1])+46,dl=[left[0],widthY],dr=[right[0],widthY];
 svg+=dragLine('right',dl,dr,'左右拖动：基础总宽 '+fmt(g.B)+' m')+dragNode('left',left,'基础左端，总宽 '+fmt(g.B)+' m','ew-resize')+dragNode('right',right,'基础右端，总宽 '+fmt(g.B)+' m','ew-resize');
 $('drawing').innerHTML=svg;

}
function update(){
 $('status').textContent='';$('subtitle').textContent=(mode==='simple'?'简版 · 8 项参数':'详版 · 独立控制尺寸')+' / 河道在左，堤顶在右';
 $('rules').innerHTML=mode==='simple'?'<p>基础厚度 0.50 m；基础顶位于平台下 1.00 m；墙顶＝基础顶＋墙高；墙后起坡点位于墙顶下 0.50 m。河底与堤顶各展示 3.00 m。</p>'+(type==='rc'?'<p>钢混：墙顶厚 0.30 m，墙根厚 0.50 m；墙趾＝（底板宽−0.50）÷3，剩余为墙踵。</p>':'<p>浆砌石：墙顶宽 0.60 m；基础前后各外伸 0.25 m；根据基础总宽和墙高反算墙面、墙背对称坡率。切换详版后可分别调整。</p>'):'<p>详版采用当前输入值。墙高根据墙顶、基础底高程与基础厚度计算；浆砌石墙底宽和基础总宽根据坡率及外伸尺寸计算。</p>';
 try{model=geometry(parameters());render(model);$('error').style.display='none';$('valid').textContent='参数有效 · 已更新';$('valid').style.background='#e9f7f2';$('export').disabled=false;const g=model,p=g.p;$('stats').innerHTML=[['墙高',fmt(p.height)+' m'],['墙顶高程',fmt(p.wallTop)+' m'],['基础总宽',fmt(g.B)+' m'],['结构截面积',fmt(g.area)+' m²']].map(([a,b])=>'<div class="stat"><small>'+a+'</small><b>'+b+'</b></div>').join('');}
 catch(e){model=null;$('error').textContent=e.message;$('error').style.display='block';$('valid').textContent='请检查参数';$('valid').style.background='#fff0ef';$('export').disabled=true;$('drawing').innerHTML='<text x="550" y="320" text-anchor="middle" fill="#a1aebe" font-size="18">修正参数后显示断面</text>';$('stats').innerHTML='';}
 window.dispatchEvent(new CustomEvent('wall:updated',{detail:{g:model,type,mode}}));
}
function switchMode(next){
 if(next===mode)return;
 if(!model){$('status').textContent='请先修正当前参数，再切换输入模式。';return;}
 const previous={state:{...state},mode};
 state=next==='detail'?{...model.p}:{...state,height:model.p.height,baseWidth:model.B};mode=next;
 try{geometry(parameters());}
 catch(e){state=previous.state;mode=previous.mode;$('status').textContent='当前断面不能按简版默认规则表达，已保留详细尺寸。';return;}
 form();
}
function dxf(g){
 let out=[];const pair=(c,v)=>out.push(String(c),String(v));const unicode=s=>Array.from(s).map(c=>c.charCodeAt(0)>127?'\\U+'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'):c).join('');
 pair(0,'SECTION');pair(2,'HEADER');pair(9,'$ACADVER');pair(1,'AC1021');pair(9,'$INSUNITS');pair(70,6);pair(0,'ENDSEC');
 pair(0,'SECTION');pair(2,'TABLES');pair(0,'TABLE');pair(2,'LAYER');pair(5,'100');pair(70,5);[['WALL',7],['BASE',7],['TERRAIN',8],['DIM',3],['LABEL',5]].forEach(([n,c])=>{pair(0,'LAYER');pair(2,n);pair(70,0);pair(62,c);pair(6,'CONTINUOUS')});pair(0,'ENDTAB');pair(0,'TABLE');pair(2,'STYLE');pair(5,'101');pair(70,1);pair(0,'STYLE');pair(2,'STANDARD');pair(70,0);pair(40,0);pair(41,1);pair(50,0);pair(71,0);pair(42,.15);pair(3,'simsun.ttf');pair(4,'');pair(0,'ENDTAB');pair(0,'ENDSEC');pair(0,'SECTION');pair(2,'ENTITIES');
 const line=(a,b,layer)=>{pair(0,'LINE');pair(8,layer);pair(10,a[0]);pair(20,a[1]);pair(30,0);pair(11,b[0]);pair(21,b[1]);pair(31,0)};
 const path=(pts,layer,closed=false)=>{for(let i=1;i<pts.length;i++)line(pts[i-1],pts[i],layer);if(closed)line(pts.at(-1),pts[0],layer)};
 const text=(a,t,layer='LABEL',h=.18)=>{pair(0,'TEXT');pair(8,layer);pair(10,a[0]);pair(20,a[1]);pair(30,0);pair(40,h);pair(1,unicode(t));pair(7,'STANDARD');pair(50,0)};
 path(g.body,'WALL',true);path(g.base,'BASE',true);path(g.front,'TERRAIN');path(g.back,'TERRAIN');
 const p=g.p;[[g.front[1],'河底'],[g.front[2],'平台'],[g.body[2],'墙顶'],[g.back[0],'墙后起坡点'],[g.back[1],'堤顶'],[g.base[0],'基础底']].forEach(([a,t],i)=>text([a[0],a[1]+(i===5?-.35:.25)],t+' '+fmt(a[1])));
 text([(g.front[1][0]+g.front[2][0])/2,(p.river+p.platform)/2+.25],'1:'+p.frontSlope);text([(g.back[0][0]+g.back[1][0])/2,(p.backStart+p.crest)/2+.25],'1:'+p.backSlope);
 function dim(a,b,y,label){const aa=[a[0],y],bb=[b[0],y];line(a,[a[0],y+.12],'DIM');line(b,[b[0],y+.12],'DIM');line(aa,bb,'DIM');[aa,bb].forEach(v=>line([v[0]-.08,v[1]-.08],[v[0]+.08,v[1]+.08],'DIM'));text([(a[0]+b[0])/2,y+.12],label,'DIM');}
 dim(g.front[2],g.front[3],p.platform+.6,'平台净宽 '+fmt(p.platformWidth));dim(g.base[0],g.base[1],p.baseBottom-.7,'基础总宽 '+fmt(g.B));
 text([g.front[0][0],Math.max(p.wallTop,p.crest)+1],type==='rc'?'钢筋混凝土挡墙横断面':'浆砌块石挡墙横断面','LABEL',.3);text([g.front[0][0],p.baseBottom-1.3],'单位：m；墙高 '+fmt(p.height)+'；基础厚 '+fmt(p.baseThickness));
 pair(0,'ENDSEC');pair(0,'EOF');return out.join('\r\n')+'\r\n';
}
function download(content,name,mime){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 $('simpleTab').onclick=()=>switchMode('simple');$('detailTab').onclick=()=>switchMode('detail');$('wallType').onchange=e=>{type=e.target.value;form()};$('reset').onclick=()=>{state={...defaults};form()};$('export').onclick=()=>{if(!model)return;download(dxf(model),(type==='rc'?'钢混挡墙':'浆砌块石挡墙')+'_'+(mode==='simple'?'简版':'详版')+'.dxf','application/dxf');$('status').textContent='DXF 已生成，请在浏览器下载列表中查看。CAD 模型空间单位：米。';};

function pointerPosition(e){const svg=$('drawing'),matrix=svg.getScreenCTM();if(!matrix)return null;return new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());}
function dragCandidate(snapshot,p,action,delta,currentMode,currentType){
 const next={...snapshot};
 if(action==='height'){
  if(currentMode==='simple')next.height=p.height+delta;
  else next.wallTop=p.wallTop+delta;
 }else if(currentMode==='simple'){
  next.baseWidth=p.baseWidth+(action==='left'?-delta:delta);
 }else if(currentType==='rc'){
  next.baseWidth=p.baseWidth+(action==='left'?-delta:delta);
  if(action==='left')next.toe=p.toe-delta;
 }else{
  const key=action==='left'?'frontExtension':'rearExtension';next[key]=p[key]+(action==='left'?-delta:delta);
 }
 return next;
}
function applyDrag(session,delta){const previous=state;state=dragCandidate(session.state,session.p,session.action,delta,mode,type);try{geometry(parameters());}catch{state=previous;$('status').textContent='已到达有效尺寸边界；请调整墙体或地形尺寸。';return false;}update();$('fields').querySelectorAll('[data-key]').forEach(el=>{const v=state[el.dataset.key];if(Number.isFinite(v))el.value=Number(v.toFixed(4));});$('status').textContent=(session.action==='height'?'墙高 '+fmt(model.p.height)+' m，墙顶高程 '+fmt(model.p.wallTop)+' m':'基础总宽 '+fmt(model.B)+' m')+(mode==='simple'?' · 简版按默认规则联动':'');return true;}
const dragSvg=$('drawing');
dragSvg.addEventListener('pointerdown',e=>{const target=e.target.closest('[data-drag]');if(!target||!model||e.button>0||dragSession)return;const point=pointerPosition(e);if(!point)return;e.preventDefault();dragSession={action:target.dataset.drag,start:point,state:{...state},p:{...model.p},view:{...model.view},pointer:e.pointerId};dragSvg.setPointerCapture(e.pointerId);dragSvg.classList.add('drag-active');});
dragSvg.addEventListener('pointermove',e=>{if(!dragSession||e.pointerId!==dragSession.pointer)return;const point=pointerPosition(e);if(!point)return;e.preventDefault();const s=dragSession,step=e.shiftKey?.01:.05,raw=s.action==='height'?(s.start.y-point.y)/s.view.scale:(point.x-s.start.x)/s.view.scale,delta=Number((Math.round(raw/step)*step).toFixed(4));applyDrag(s,delta);});
function finishDrag(e){if(!dragSession||e.pointerId!==dragSession.pointer)return;const pointer=dragSession.pointer;dragSession=null;dragSvg.classList.remove('drag-active');if(dragSvg.hasPointerCapture(pointer))dragSvg.releasePointerCapture(pointer);if(model)render(model);}
dragSvg.addEventListener('pointerup',finishDrag);dragSvg.addEventListener('pointercancel',finishDrag);dragSvg.addEventListener('lostpointercapture',finishDrag);
dragSvg.addEventListener('keydown',e=>{const target=e.target.closest('[data-drag]');if(!target||!model||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;const action=target.dataset.drag;if(action==='height'&&!['ArrowUp','ArrowDown'].includes(e.key))return;if(action!=='height'&&!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const step=e.shiftKey?.01:.05,sign=['ArrowUp','ArrowRight'].includes(e.key)?1:-1;applyDrag({action,state:{...state},p:{...model.p}},step*sign);const replacement=dragSvg.querySelector('[data-drag="'+action+'"]');if(replacement)replacement.focus();});
 form();

