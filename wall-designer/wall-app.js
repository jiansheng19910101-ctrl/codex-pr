/* Platform integration around the upstream geometry demo. All file generation stays in the browser. */
'use strict';
let wallScene=null,lastSignature='',resultUrl=null,resultSvgUrl=null,artifactUrl=null,construction={};
const knownConstruction=['sectionLength','jointWidth','jointSpace','keyWidth','keyDepth','keyOffset','cushionThick','cushionExtend','holeDiameter','holeHSpace','holeVSpace','holeBottom','filterThick'];
function setStatus(message){$('status').textContent=message;}
function saveArtifact(content,name,mime,label,message){
 if(artifactUrl)URL.revokeObjectURL(artifactUrl);artifactUrl=URL.createObjectURL(new Blob([content],{type:mime}));
 setStatus(message+' ');const a=document.createElement('a');a.href=artifactUrl;a.download=name;a.textContent=label;$('status').append(a);a.click();
}
function releaseResults(){if(resultUrl)URL.revokeObjectURL(resultUrl);if(resultSvgUrl)URL.revokeObjectURL(resultSvgUrl);resultUrl=resultSvgUrl=null;}
function sectionSvg(){
 const svg=$('drawing').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width','1100');svg.setAttribute('height','650');
 svg.querySelectorAll('.drag-target').forEach(n=>n.remove());
 svg.querySelectorAll('[tabindex]').forEach(n=>n.removeAttribute('tabindex'));
 const style=document.createElementNS('http://www.w3.org/2000/svg','style');
 style.textContent='text{font-family:Microsoft YaHei,Arial,sans-serif}.drag-dim{stroke:#1762ca;stroke-width:1.5;fill:none}.drag-label{fill:#1762ca;font-size:12px;paint-order:stroke;stroke:white;stroke-width:4px}';
 svg.prepend(style);return '<?xml version="1.0" encoding="UTF-8"?>\n'+svg.outerHTML;
}
function syncTypeTabs(){
 document.querySelectorAll('[data-wall-type]').forEach(b=>{const on=b.dataset.wallType===type;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
 $('wall-workspace').setAttribute('aria-labelledby','type-'+type);
 $('simpleTab').setAttribute('aria-pressed',String(mode==='simple'));$('detailTab').setAttribute('aria-pressed',String(mode==='detail'));
}
function syncPreview(){
 syncTypeTabs();
 const valid=!!model;$('model-invalid').hidden=valid;
 ['capture3d','saveSvg','saveParams'].forEach(id=>$(id).disabled=!valid);
 const signature=JSON.stringify({state,mode,type});
 if(lastSignature&&lastSignature!==signature&&resultUrl){releaseResults();$('draw-result').textContent='参数已修改，请点击「断面图一键绘制」生成当前断面的 DXF。';}
 lastSignature=signature;
 if(!valid){$('model-status').textContent='参数无效，三维和文件导出暂不可用。';return;}
 const g=model;
 $('model-summary').textContent=(type==='rc'?'钢混悬臂式':'浆砌石重力式')+' · 长 15.00 m';
 const stats=$('stats').lastElementChild;
 if(stats){stats.querySelector('small').textContent='15 m 结构体积';stats.querySelector('b').textContent=fmt(g.area*15)+' m³';stats.title='结构截面积 '+fmt(g.area)+' m² × 示意段长 15 m；仅几何体积';}
 if(wallScene)wallScene.update(g,type);
 $('capture3d').disabled=!wallScene?.ready;
}
window.addEventListener('wall:updated',syncPreview);
try{wallScene=new WallScene($('wall-viewport'),{onStatus:message=>{$('model-status').textContent=message;}});}
catch(e){$('model-status').textContent='三维暂不可用：'+e.message;$('capture3d').disabled=true;}
document.querySelectorAll('[data-wall-type]').forEach(b=>{
 b.addEventListener('click',()=>{if(type===b.dataset.wallType)return;$('wallType').value=b.dataset.wallType;$('wallType').dispatchEvent(new Event('change'));});
 b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=(e.key==='Home'||e.key==='ArrowLeft')?'rc':'stone';$('type-'+next).click();$('type-'+next).focus();});
});
document.querySelectorAll('[data-wall-view]').forEach(b=>b.onclick=()=>{if(!model||!wallScene)return;wallScene.setView(b.dataset.wallView);document.querySelectorAll('[data-wall-view]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));});
$('resetView').onclick=()=>{if(wallScene)wallScene.reset();document.querySelectorAll('[data-wall-view]').forEach(v=>v.setAttribute('aria-pressed',String(v.dataset.wallView==='perspective')));};
for(const [id,key] of [['showSoil','soil'],['showWater','water']])$(id).onchange=e=>{if(wallScene)wallScene.setVisibility({[key]:e.target.checked});};
$('wall-drawings').addEventListener('toggle',()=>{if(wallScene)wallScene.resize();});
$('export').onclick=()=>{
 if(!model)return;const start=performance.now(),name=(type==='rc'?'钢混悬臂式':'浆砌石重力式')+'护岸横断面';
 releaseResults();resultUrl=URL.createObjectURL(new Blob([dxf(model)],{type:'application/dxf'}));resultSvgUrl=URL.createObjectURL(new Blob([sectionSvg()],{type:'image/svg+xml;charset=utf-8'}));
 const result=$('draw-result');result.replaceChildren();
 const summary=document.createElement('div');summary.textContent='已生成 '+name+' · '+((performance.now()-start)/1000).toFixed(2)+' s · 单位 m';result.append(summary);
 for(const [href,filename,label] of [[resultUrl,name+'.dxf','下载 DXF'],[resultSvgUrl,name+'.svg','查看 / 保存断面图']]){const a=document.createElement('a');a.href=href;a.download=filename;a.textContent=label;result.append(a);}
 result.querySelector('a').click();setStatus('DXF 已生成。墙体、基础、地形、尺寸及文字已分层。');
};
$('saveSvg').onclick=()=>{if(model)saveArtifact(sectionSvg(),'护岸横断面.svg','image/svg+xml;charset=utf-8','下载 SVG','断面图已生成。');};
$('drawingFit').onclick=()=>{const fitted=document.querySelector('.canvas').classList.toggle('fit');$('drawingFit').textContent=fitted?'放大':'全图';$('drawingFit').setAttribute('aria-pressed',String(fitted));};
$('capture3d').onclick=()=>{
 if(!model||!wallScene)return;try{const data=wallScene.capture();if(!data)throw Error('当前浏览器未返回三维图');const bytes=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));saveArtifact(bytes,'护岸三维示意_15m.png','image/png','下载 PNG','三维示意图已生成，段长 15 m。');}catch(e){setStatus('三维图保存失败：'+e.message);}
};
$('saveParams').onclick=()=>{
 if(!model)return;
 const payload={format:'wall-dimensions',version:1,type,mode,geometry:{...state},construction:{...construction},preview:{sectionLength:15,soil:'illustrative'}};
 saveArtifact(JSON.stringify(payload,null,2),'护岸尺寸参数.json','application/json','下载 JSON','参数文件已生成，可用「导入参数」恢复。');
};
$('loadParams').onclick=()=>$('paramFile').click();
$('paramFile').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 const previous={state:{...state},type,mode,construction:{...construction}};
 try{
  if(file.size>1000000)throw Error('文件过大，请选择尺寸参数 JSON');
  const data=JSON.parse(await file.text());
  if(data.format!=='wall-dimensions'||data.version!==1||!['rc','stone'].includes(data.type)||!['simple','detail'].includes(data.mode))throw Error('不是有效的护岸尺寸参数文件');
  const restored={};for(const key of Object.keys(defaults)){const value=data.geometry?.[key];if(typeof value!=='number'||!Number.isFinite(value))throw Error('断面尺寸缺失或无效：'+defs[key][0]);restored[key]=value;}
  const extras={};for(const key of knownConstruction){const value=data.construction?.[key];if(value==null)continue;if(typeof value!=='number'||!Number.isFinite(value)||(key!=='holeBottom'&&value<0))throw Error('可选构造尺寸无效');extras[key]=value;}
  state=restored;type=data.type;mode=data.mode;geometry(parameters());construction=extras;
  $('wallType').value=type;form();setStatus('参数已导入。三维示意段长固定为 15 m。');
 }catch(err){state=previous.state;type=previous.type;mode=previous.mode;construction=previous.construction;setStatus('导入失败：'+err.message);}
 finally{e.target.value='';}
};
const upstreamReset=$('reset').onclick;$('reset').onclick=()=>{construction={};upstreamReset();};
window.WallDemo={
 getModel:()=>model,
 getParameters:()=>({state:{...state},type,mode}),
 getSceneState:()=>wallScene?.getState?.(),
 getDxf:()=>model?dxf(model):null,
 getSvg:()=>model?sectionSvg():null
};
const WALL_SESSION_KEY='sz-wall-workspace-v1';
function saveWorkspace(){
 try{sessionStorage.setItem(WALL_SESSION_KEY,JSON.stringify({state,type,mode,construction,scene:wallScene?.getState(),soil:$('showSoil').checked,water:$('showWater').checked,drawings:$('wall-drawings').open,rules:document.querySelector('.rules-box').open,scroll:document.querySelector('.lk-body')?.scrollTop||0}));}catch{}
}
function restoreWorkspace(){
 try{
  if(performance.getEntriesByType('navigation')[0]?.type==='reload'){sessionStorage.removeItem(WALL_SESSION_KEY);return;}
  const saved=JSON.parse(sessionStorage.getItem(WALL_SESSION_KEY)||'null');
  if(!saved||!['rc','stone'].includes(saved.type)||!['simple','detail'].includes(saved.mode))return;
  const restored={};for(const key of Object.keys(defaults)){const n=saved.state?.[key];if(n!==null&&(typeof n!=='number'||!Number.isFinite(n)))return;restored[key]=n===null?NaN:n;}
  state=restored;type=saved.type;mode=saved.mode;construction=saved.construction||{};$('wallType').value=type;form();
  $('showSoil').checked=saved.soil!==false;$('showWater').checked=saved.water===true;
  wallScene?.setVisibility({soil:$('showSoil').checked,water:$('showWater').checked});wallScene?.restoreState(saved.scene);
  $('wall-drawings').open=saved.drawings===true;document.querySelector('.rules-box').open=saved.rules===true;
  document.querySelectorAll('[data-wall-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wallView===saved.scene?.view)));
  requestAnimationFrame(()=>{const scroller=document.querySelector('.lk-body');if(scroller&&Number.isFinite(saved.scroll))scroller.scrollTop=Math.max(0,saved.scroll);});
 }catch{}
}
window.addEventListener('pagehide',e=>{saveWorkspace();if(!e.persisted){releaseResults();if(artifactUrl)URL.revokeObjectURL(artifactUrl);wallScene?.dispose();}});
window.addEventListener('pageshow',e=>{if(e.persisted)wallScene?.resize();});
for(const event of ['pointerup','wheel','keydown'])$('wall-viewport').addEventListener(event,()=>requestAnimationFrame(()=>{const view=wallScene?.getState()?.view;document.querySelectorAll('[data-wall-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wallView===view)));}));
restoreWorkspace();update();

