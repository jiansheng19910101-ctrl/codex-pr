const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'wall-core.js'), 'utf8');
const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) nodes.set(id, { textContent: '', value: '', disabled: false, style: {}, classList: { toggle() {} }, querySelectorAll() { return []; } });
  return nodes.get(id);
};
const ctx = vm.createContext({ document: { getElementById: node }, console });
const pure = source.slice(0, source.indexOf(" $('simpleTab').onclick"));
const drag = source.slice(source.indexOf('function dragCandidate('), source.indexOf('function applyDrag('));
vm.runInContext(pure + '\n' + drag + `
  form = function () { model = geometry(parameters()); };
  globalThis.audit = {
    defaults,
    set(o = {}) { state = {...defaults, ...o.state}; type = o.type || 'rc'; mode = o.mode || 'simple'; model = null; },
    params: parameters, geometry, dxf, dragCandidate, switchMode,
    build() { return model = geometry(parameters()); },
    get() { return {state: {...state}, type, mode, model}; }
  };`, ctx);
const a = ctx.audit;
const results = [];
const test = (name, fn) => { try { fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.message }); } };
const near = (x, y, m = '') => assert.ok(Math.abs(x - y) < 1e-7, `${m}: ${x} != ${y}`);
const area = r => Math.abs(r.reduce((s, v, i) => { const q = r[(i + 1) % r.length]; return s + v[0] * q[1] - q[0] * v[1]; }, 0)) / 2;
const clone = v => JSON.parse(JSON.stringify(v));
const signature = g => JSON.stringify([g.body, g.base, g.front, g.back, g.area, g.B]);
const summaries = [];
for (const type of ['rc', 'stone']) for (const mode of ['simple', 'detail']) {
  test(`${type}/${mode} geometry and DXF`, () => {
    a.set({ type, mode });
    const g = a.build();
    near(area(g.body) + area(g.base), g.area, 'shoelace structural area');
    near(g.base[1][0] - g.base[0][0], g.B, 'base width');
    near(g.p.wallTop - g.z, g.p.height, 'height');
    near(g.front[3][0] - g.front[2][0], g.p.platformWidth, 'platform width');
    near(g.front[2][0] - g.front[1][0], (g.p.platform - g.p.river) * g.p.frontSlope, 'front slope');
    near(g.back[1][0] - g.back[0][0], (g.p.crest - g.p.backStart) * g.p.backSlope, 'rear slope');
    const wallFront = type === 'rc' ? (g.p.rootThickness - g.p.topThickness) * (g.p.platform - g.z) / g.p.height : g.p.faceSlope * (g.p.platform - g.z);
    const wallBack = type === 'rc' ? g.p.rootThickness : g.body[1][0] - g.p.rearSlope * (g.p.backStart - g.z);
    near(g.front.at(-1)[0], wallFront, 'front terrain meets wall');
    near(g.back[0][0], wallBack, 'back terrain meets wall');
    const d = a.dxf(g);
    assert.match(d, /\$INSUNITS\r\n70\r\n6/);
    assert.ok(!/NaN|Infinity/.test(d));
    fs.writeFileSync(path.join(__dirname, `audit-${type}-${mode}.dxf`), d);
    summaries.push({type, mode, width:g.B, height:g.p.height, area:g.area, body:clone(g.body), base:clone(g.base)});
  });
  test(`${type}/${mode} drag height and width`, () => {
    a.set({type,mode}); const g = a.build(), before = a.get();
    const up = a.dragCandidate(before.state,g.p,'height',0.2,mode,type);
    a.set({type,mode,state:up}); near(a.build().p.height,g.p.height+0.2,'drag height');
    for (const side of ['left','right']) {
      const delta = side === 'left' ? -0.1 : 0.1;
      const next=a.dragCandidate(before.state,g.p,side,delta,mode,type);
      a.set({type,mode,state:next});const ng=a.build();near(ng.B,g.B+0.1,'drag width');
      if(mode==='detail') near(side==='left'?ng.base[1][0]:ng.base[0][0],side==='left'?g.base[1][0]:g.base[0][0],'opposite base end fixed');
    }
    assert.equal(signature(g),signature(before.model),'drag should not mutate source model');
  });
}
for (const type of ['rc','stone']) {
  test(`${type} simple-detail-simple continuity`,()=>{
    a.set({type});const original=signature(a.build());a.switchMode('detail');assert.equal(signature(a.get().model),original);
    a.switchMode('simple');assert.equal(signature(a.get().model),original);
  });
}
const invalids=[
  ['NaN height','simple','rc',{height:NaN}],['infinite width','simple','rc',{baseWidth:Infinity}],
  ['zero base width','simple','rc',{baseWidth:0}],['negative toe','detail','rc',{toe:-.1}],
  ['toe exceeds base width','detail','rc',{toe:3.1}],['root smaller than top','detail','rc',{rootThickness:.2}],
  ['zero height','simple','rc',{height:0}],['platform below footing top','detail','rc',{platform:10.9}],
  ['platform at wall top','detail','rc',{platform:14}],['river above platform','detail','rc',{river:12.1}],
  ['back start below footing','detail','rc',{backStart:10.9}],['back start above wall','detail','rc',{backStart:14.1}],
  ['crest below start','detail','rc',{crest:13}],['zero front slope','detail','rc',{frontSlope:0}],
  ['negative rear slope','detail','stone',{rearSlope:-.1}],['negative foundation extension','detail','stone',{frontExtension:-.1}],
  ['too narrow simple stone base','simple','stone',{baseWidth:.9}],['too large elevation','detail','stone',{crest:100001}],
  ['negative base thickness','detail','stone',{baseThickness:-.1}]
];
for(const [name,mode,type,state] of invalids)test('reject '+name,()=>{a.set({mode,type,state});assert.throws(()=>a.build());});
test('negative elevations allowed when valid',()=>{a.set({mode:'detail',state:{river:-10,platform:-8,baseBottom:-9.5,wallTop:-6,backStart:-6.5,crest:-4}});assert.ok(a.build());});

// Import handler is run in the same lexical context. No browser is used.
const app = fs.readFileSync(path.join(root, 'wall-app.js'),'utf8');
vm.runInContext("let construction={}; const knownConstruction="+app.match(/const knownConstruction=(\[[^;]+\]);/)[1]+";function setStatus(s){$('status').textContent=s;}\n"+app.slice(app.indexOf("$('paramFile').onchange=async"),app.indexOf('const upstreamReset=')),ctx);
async function importTest(name,data,expectedSuccess){
  a.set({type:'rc',mode:'simple',state:{height:4}});a.build();const before=clone(a.get());
  const event={target:{files:[{size:1000,text:async()=>typeof data==='string'?data:JSON.stringify(data)}],value:'selected'}};
  try{
    await node('paramFile').onchange(event);const success=node('status').textContent.startsWith('参数已导入');assert.equal(success,expectedSuccess,node('status').textContent);
    if(!expectedSuccess)assert.deepEqual(clone(a.get()),before,'invalid import mutated active state or model');
    assert.equal(event.target.value,'');results.push({name,pass:true});
  }catch(e){results.push({name,pass:false,error:e.message});}
}
(async()=>{
  const payload={format:'wall-dimensions',version:1,type:'stone',mode:'detail',geometry:clone(a.defaults),construction:{holeDiameter:.1,sectionLength:15}};
  await importTest('valid JSON import',payload,true);
  await importTest('reject malformed JSON','{bad',false);
  await importTest('reject wrong format',{...payload,format:'wrong'},false);
  await importTest('reject missing geometry',{...payload,geometry:{height:3}},false);
  await importTest('reject non-number geometry',{...payload,geometry:{...payload.geometry,height:'3'}},false);
  await importTest('reject invalid wall geometry',{...payload,geometry:{...payload.geometry,wallTop:10}},false);
  await importTest('reject invalid construction',{...payload,construction:{holeDiameter:-1}},false);
  const detailChecks=[];
  for(const type of ['rc','stone']){
    test(`${type} invalid target simple mode preserves valid detail`,()=>{
      a.set({type,mode:'detail',state:{wallTop:12,platform:11.5,backStart:11.8,crest:13,baseBottom:10.5}});a.build();
      const before=clone(a.get());a.switchMode('simple');const after=clone(a.get());
      assert.deepEqual(after,before);assert.match(node('status').textContent,/已保留/);
      detailChecks.push({type,preservedMode:after.mode,valid:!!after.model,status:node('status').textContent});
    });
  }
  const output={results,summaries,detailToSimpleCustom:detailChecks,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length};
  fs.writeFileSync(path.join(__dirname,'geometry-audit.json'),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
  if(output.failed)process.exitCode=1;
})();
