/* ============================================================
   上咨设计平台 · 全站统一外壳（左侧导航 + 顶栏 + 内容区 + 说明抽屉）

   —— 根目录这份是母版，每个页面目录下有一份同名副本；
      改完母版跑一次  python 同步样式.py  就全站生效。

   用法：页面 <head> 里写
       <link rel="stylesheet" href="lark-theme.css">
       <link rel="stylesheet" href="app-shell.css">
       <script>window.LK_SHELL = { ... };</script>
       <script src="app-shell.js" defer></script>

   defer 脚本在整份文档解析完、DOMContentLoaded 之前执行，所以页面自己写在
   body 末尾的内联脚本已经拿到过 DOM 引用了；本脚本只是把这些节点搬进
   .lk-body，节点身份不变，事件监听和已保存的引用都继续有效。
   （已执行过的 <script> 节点被移动不会重新执行，但这里仍然把 script/style/
     link/template 留在原地不动，省得踩到浏览器差异。）

   配置项见下面 CFG 的注释。
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.LK_SHELL || {};

  /* ============================================================
     全站主题：蓝 / 白 / 粉 / 金（**只在首页选**）

     选择器只出现在首页封面顶栏那一处（index.html 里的 .hub-theme-control），
     子网页一律不摆控件——顶栏那排按钮的位置是用户记熟了的，每页多一个下拉
     既占地方又容易误点。子页面只负责**开局把首页选的那套色套回本页**
     （<html data-hub-theme="…">），左导航、顶栏、内容区、页面正文一起换色。

     加第五套主题只要在 css 里补一段变量，再把名字加进下面的 THEME_LIST；
     本文件其余地方不用动。金色（gold）就是这么加的：深炭棕导航 + 土金点睛，
     深色导航沿用白描边图标，不走浅色导航那段重描。

     存两份是有原因的：
       · localStorage —— 正常从统一入口（反向代理 8000）进来时，所有工具页同
         源，一份就够；
       · cookie —— cookie **不分端口**，直接开某个子服务自己的端口（8035/8041…）
         时 localStorage 是另一份，读不到首页的选择，这时靠 cookie 兜住。
     先读 localStorage，读不到再读 cookie；写的时候两个都写。
     ============================================================ */
  var THEME_KEY = 'sz-hub-theme';
  var THEME_LIST = [
    { v: 'blue',  name: '蓝色' },
    { v: 'white', name: '白色' },
    { v: 'pink',  name: '粉色' },
    { v: 'gold',  name: '金色' }
  ];

  function readTheme() {
    var v = null;
    try { v = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (!v) {
      var m = document.cookie.match(/(?:^|;\s*)sz-hub-theme=([^;]*)/);
      if (m) { try { v = decodeURIComponent(m[1]); } catch (e2) { v = m[1]; } }
    }
    for (var i = 0; i < THEME_LIST.length; i++) if (THEME_LIST[i].v === v) return v;
    return 'blue';
  }

  function applyTheme(v) { document.documentElement.dataset.hubTheme = v; }

  function saveTheme(v) {
    try { localStorage.setItem(THEME_KEY, v); } catch (e) {}
    try {
      document.cookie = THEME_KEY + '=' + encodeURIComponent(v) +
        '; path=/; max-age=31536000; samesite=lax';
    } catch (e) {}
    // 第三份：服务端（反向代理 /api/hub-theme，存在站点根目录 hub_theme.json）。
    // 换浏览器、清站点数据、主机名从 shixiaohuan 换成 localhost 时，上面两份都
    // 读不到了，靠这份把主题找回来（lk-theme.js 在首帧前会来问）。
    try { if (window.LKPushTheme) window.LKPushTheme(v); } catch (e) {}
  }

  function setTheme(v) {
    applyTheme(v);
    saveTheme(v);
    // 首页自己监听这个事件重画封面（星空/樱花那套配色），子页面换完就完事
    try {
      document.dispatchEvent(new CustomEvent('hub-theme-change', { detail: v }));
    } catch (e) {}
  }

  applyTheme(readTheme());
  // 在首页改了主题，其它已经打开的标签页跟着变（同源才收得到这条事件）
  window.addEventListener('storage', function (e) {
    if (e.key === THEME_KEY) applyTheme(readTheme());
  });
  window.LKGetTheme = readTheme;
  window.LKSetTheme = setTheme;

  // name     左导航标题，默认「上咨设计」
  // home     左导航 logo 和板块链接指向的工作台地址，默认 '/'
  // hub      本页就是工作台首页（板块链接写成纯锚点 #agent，不带路径）
  // brand    顶栏公司 logo 图片地址（只有主站目录里有这张图，其余页面不填）
  // title    顶栏页面名
  // tag      顶栏小标签，字符串，或 {text:'…', warn:true}（warn 为黄色）
  // desc     顶栏一句话说明（只占一行，窄屏自动隐藏）
  // doc      「使用说明」抽屉要加载的页面，不填则不出这个按钮
  // headerTarget 可选选择器：将顶栏操作并入已有标签栏，省去独立标题行
  // caseTarget 可选选择器：将同一个案例按钮放入页面已有操作栏；找不到时沿用公共顶栏
  // dense    子页面默认紧凑顶栏与正文间距；显式 false 可保留原密度，首页保持原版式
  // demo     「示例文件」压缩包的地址（相对本页），不填则不出这个按钮。
  //          包放在页面目录下的 下载/ 里 —— 站点的 .zip 白名单认的就是这个目录名，
  //          见 _pathguard.py 的 DOWNLOAD_DIR；放到别处会被反向代理判 403。
  // cases    「一键导入案例」：把这一页的示例输入直接放进上传区、参数一并填好，
  //          点完只剩「下一步」那一下。不填则不出这个按钮。写法：
  //            cases: {
  //              name:  '青浦吴马河 A 型护岸断面',   // 悬停提示 / 菜单里说明这是哪个案例
  //              next:  '点「生成全部」',            // 导入完的提示语，说下一步点哪儿
  //              files: [                            // 按顺序投放，to 不填 = 第一个拖拽区
  //                { url: '下载/案例/xx.dwg', to: '#dropDwg' },
  //                { url: '下载/案例/yy.pdf', to: '#dropPdf' }
  //              ],
  //              fields: { '#codes': 'G11' },        // 顺手填的参数（input/select/勾选框）
  //              serial: true,                       // 同一个区投多个文件时一个一个投
  //              frame:  '#fr-river',                // 工具装在 iframe 里时填（高程云图）
  //              then:   function (win, doc) {}      // 还要额外做点什么就写这儿
  //            }
  //          一页里有**多个案例**（新旧图纸各一套之类）就写成上面这种对象的数组：
  //            cases: [ { name: '…', files: […] }, { name: '…', files: […] } ]
  //          按钮会点开一个菜单让用户挑一个导入；只有一个案例时点一下直接导，不出菜单。
  //          案例文件放在页面目录的 下载/案例/ 下，和「示例文件」压缩包里的
  //          示例输入/ 是同一批文件，都由 示例文件包清单.py 一起生成。
  // actions  选择器：把页面自己的工具条整块搬进顶栏左侧（挨着标题）
  // pad      内容区是否套统一内边距（页面自己有 .wrap/.container 时填 false）
  // backTop  是否要「回到顶部」按钮
  // spy      顶部锚点滚动高亮（主站首页用）
  // cat      本页所属板块：home|agent|engineering|calc|kb（下面 SITE 的 key）
  //          （原来还有 devtools / wip 两个板块，都已撤掉，见下面 PLATFORM_SITE 的注释）
  // page     本页是该板块下的哪个工具（下面 SITE items 的 key），用来高亮
  // groups   可选的「本页目录」锚点 [{label, items:[{text, href, ic, on}]}]，
  //          条目作为三级条目挂在树里本页自己的条目后面（如高程云图），
  //          不单独占侧栏顶部一节；只有页内还有锚点要跳的页面才需要
  // site     换掉下面那棵全站导航树（见 SITE 的注释）；不填就是上咨AI平台那棵
  // siteLbl  导航树上面那行小标题，默认「功能板块」
  // guard    任务守卫（见下面「任务守卫」那一节）。默认开；填 false 关掉这一页的守卫

  var HOME = CFG.home || '/';

  /* ---------- 站点地图 ----------
     下面 PLATFORM_SITE 是上咨AI平台自己那棵树。页面可以用 LK_SHELL.site 换成
     **另一个站点**的树 —— 涉河论证报告Agent 从平台剥出去之后自成一个小站
     （主站 + 几个配套工具，见母版 river-site.js），它和它的配套页面走的就是这条路。
     换树的页面有两点跟平台里的页面不一样，写新树时别忘了：
       1) 它们各自开在自己的端口上，导航链接必须是**带端口的绝对地址**，
          写 /prompt/index.html 这种只在 8000 反向代理后面才成立；
       2) 顶层条目直接就是工具（没有「板块」这一层），所以顶层要认 href。

     ---------- 上咨AI平台自己那棵树（平台内唯一一份站点地图） ----------
     顶层就是工作台首页的四类用途，板块底下直接挂各自的工具：点板块名回首页对应
     板块，点右边的箭头就地展开工具清单，不用先回首页再找入口。
     各页面不再自己抄一份同级列表——只写 cat（属于哪个板块）+ page（自己是哪个
     工具），外壳自动展开所属板块并高亮当前项，于是全站左导航长得完全一样。
     新增子服务时只要在这里加一行，全站同步（改完记得跑 同步样式.py）。

     ★★ 加完条目还要跑一次 python _sync_nav_to_13.py（直接跑 同步样式.py 也会
        顺带做）。少了这一步，13 涉河论证html 那边的时间胶囊就会停在上一次：
        区水利规划总库 / 九个区的水利规划页本体都在 13，页面加载的是**那边**的
        app-shell.js 副本、挂的是**那边**这棵树的旧版 —— 2026-10-12 加「图集知识库」
        时漏了这一步，用户点「区水利规划」发现图集没了，就是这么来的。 */
  var PLATFORM_SITE = [
    /* 与首页统一按用途分四类，非草稿入口在前，草稿入口在后。
       key / hash 沿用历史值，兼容各页 LK_SHELL.cat、首页旧锚点与会话展开状态；
       当前工具的归属由其 page 在本树中的位置决定，不依赖旧 cat。
       首页从本树生成分类和入口，不再另行维护工具归属。
       2026-11-05：仅调整分组和顺序，保留全部入口、地址与逐项草稿标记。 */
    { key: 'agent', num: '01', text: '文档处理', ic: 'book', hash: '#agent', items: [
      { key: 'tplbrush', text: 'Word格式模板刷', ic: 'score',  href: '/tplbrush/' },
      { key: 'word2pdf', text: 'Word批量转PDF', ic: 'book', href: '/word2pdf/index.html' },
      { key: 'revet',   text: '护岸断面出文字',    ic: 'image',  href: '/revet/' },
      { key: 'river',   text: '涉河论证稳定版',    ic: 'wave',   href: '/river.html' },
      { key: 'review',  text: '文档校核', draft: true, ic: 'score',  href: '/review/' },
      { key: 'cctv',    text: 'CCTV检测报告提取', draft: true, ic: 'table',  href: '/cctv/' },
      { key: 'jsword',  text: 'JS_Word助手', draft: true, ic: 'plugin', href: '/01 AI Agent应用/07 Word智能校对助手/下载页.html', title: '装进 Word 的校核/改写/对话窗格 · 说明页底部下载安装包' },
      { key: 'desktop', text: '平台桌面快捷方式', draft: true, ic: 'plugin', href: '/下载/快捷方式说明.html', title: '免装版拖桌面即用 · 说明页底部下载' }
    ]},
    { key: 'engineering', num: '02', text: '制图工具', ic: 'image', hash: '#engineering', items: [
      { key: 'cadplot', text: 'CAD批量打印', ic: 'print',  href: '/cadplot/index.html' },
      { key: 'soil',    text: '土层柱状图',  ic: 'layer',  href: '/soil/index.html' },
      // 静态工具继续沿用兼容路径，由主站直接托管。
      { key: 'cadplugin', text: 'JS水工CAD插件', ic: 'plugin', href: '/03 工程设计工具/04 CAD插件/index.html' },
      { key: 'cadgray', text: 'CAD图元改灰', ic: 'grey',   href: '/cadgray/index.html' },
      { key: 'img2dxf', text: '图片/PDF转DXF', title: '图片/PDF转DXF · 自动转换并下载', ic: 'image', href: '/img2dxf/index.html' },
      { key: 'bridge',   text: '画桥',           ic: 'bridge', href: '/bridge/index.html' },
      { key: 'wall', text: '画护岸', title: '画护岸 · 参数断面与三维模型 Demo', ic: 'wall', href: '/wall/index.html' },
      { key: 'cadbrush', text: 'CAD模板格式刷', draft: true, ic: 'score', href: '/cadbrush/' },
      { key: 'elev',    text: '高程云图生成器', draft: true, ic: 'hill', href: '/01 AI Agent应用/06 高程云图/index.html' },
      { key: 'revetcolor', text: '护岸彩图', draft: true, ic: 'image', href: '/revetcolor/' },
      { key: 'coord',   text: '坐标转换', draft: true, ic: 'map', href: '/coord/index.html' }
    ]},
    { key: 'calc', num: '03', text: '工程计算', ic: 'calc', hash: '#calc', items: [
      { key: 'agri',     text: '农水计算',       draft: true, ic: 'wave',   href: '/agri/index.html' },
      { key: 'dikebreak', text: '海塘爬高计算',  draft: true, ic: 'wave',   href: '/03 工程设计工具/11 联通破堤开缺/index.html' },
      { key: 'boreholeExtract', text: '桩基承载力计算', draft: true, title: '土层信息提取+桩基承载力计算', ic: 'table', href: '/borehole/index.html' },
      { key: 'stabslope', text: '边坡整体稳定', draft: true, ic: 'hill', href: '/stabslope/index.html' },
      { key: 'earthwork', text: '土方计算', draft: true, ic: 'calc', href: '/01 AI Agent应用/27 土方计算/index.html' },
      { key: 'revetstab', text: '护岸整体稳定计算书', draft: true, ic: 'score', href: '/revetstab/' }
    ]},
    { key: 'kb', num: '04', text: '资料查询', ic: 'book', hash: '#kb', items: [
      { key: 'standards', text: '规范标准+问答', title: '规范与标准 · 编制依据一键生成 + 规范问答', ic: 'book', href: '/standards/index.html' },
      // 水利规划保留总库标识；九个区从全市地图进入，高亮归到 allwater。
      { key: 'allwater', text: '水利规划+问答', title: '水利规划 · 全市地图与各区规划', tab: '总', ic: 'book', href: '/citywater/index.html' },
      { key: 'seawall', text: '海塘',       title: '海塘知识库', ic: 'book', href: '/seawall/index.html' },
      { key: 'waterway', text: '航道', title: '航道知识库 · 市内河通航水域一张图与名录核对', ic: 'wave', href: '/waterway/index.html' },
      { key: 'atlas', text: '图集', title: '图集知识库 · 设计图集与选型样本检索问答', ic: 'image', href: '/atlas/index.html' },
      { key: 'plan2035', text: '2035总规+问答', title: '2035总规知识库 · 市级+16区级规划全文检索问答', ic: 'book', href: '/plan2035/index.html' },
      { key: 'riverreport2026', text: '2026河湖报告', title: '2026河湖报告知识库 · 报告问答与图文表引用', ic: 'book', href: '/riverreport2026/index.html' },
      { key: 'waterworks', text: '藏经阁', title: '藏经阁 · 各工程平面图/断面图归档', ic: 'image', href: '/waterworks/index.html' },
      { key: 'photos', text: '踏勘照片', draft: true, title: '踏勘照片挂载 · 本机照片按拍摄位置上图（原图不上传）', ic: 'pin', href: '/photos/index.html' },
      { key: 'seawall-plan', text: '海塘一张图', draft: true, title: '海塘一张图 · 仅依据上海市海塘平面图.pdf', ic: 'map', href: '/seawall/plan/index.html' },
      { key: 'terrain', text: '上海地形图', draft: true, title: '上海市地形图 · 本地矢量与三维地形', ic: 'map', href: '/terrain/index.html' },
      { key: 'bidding', text: '招投标信息查询', draft: true, ic: 'search', href: '/bidding/' },
      // 区页本体位于 13 项目；tabOnly 保留查询关联，不单独显示在侧栏。
      { key: 'qpwater', text: '青浦区',   title: '青浦区水利规划',   tabOnly: true, ic: 'book', href: '/citywater/index.html?district=qpwater' },
      { key: 'jdwater', text: '嘉定区',   title: '嘉定区水利规划',   tabOnly: true, ic: 'book', href: '/citywater/index.html?district=jdwater' },
      { key: 'mhwater', text: '闵行区',   title: '闵行区水利规划',   tabOnly: true, ic: 'book', href: '/citywater/index.html?district=mhwater' },
      { key: 'fxwater', text: '奉贤区',   title: '奉贤区水利规划',   tabOnly: true, ic: 'book', href: '/citywater/index.html?district=fxwater' },
      { key: 'sjwater', text: '松江区',   title: '松江区水利规划',   tabOnly: true, ic: 'book', href: '/citywater/index.html?district=sjwater' },
      { key: 'pdwater', text: '浦东新区', title: '浦东新区水利规划', tabOnly: true, ic: 'book', href: '/citywater/index.html?district=pdwater' },
      { key: 'jswater', text: '金山区',   title: '金山区水利规划',   tabOnly: true, ic: 'book', href: '/citywater/index.html?district=jswater' },
      { key: 'bswater', text: '宝山区',   title: '宝山区水利规划',   tabOnly: true, ic: 'book', href: '/citywater/index.html?district=bswater' },
      { key: 'ptwater', text: '普陀区',   title: '普陀区水利规划',   tabOnly: true, ic: 'book', href: '/citywater/index.html?district=ptwater' }
    ]}
  ];

  // 本页用哪棵树：默认上咨AI平台那棵，LK_SHELL.site 可以换成别的站点
  var SITE = CFG.site || PLATFORM_SITE;

  // 首页里锚点是同文档跳转，写成纯 '#xxx'；子页面要带上工作台地址才跳得回去
  function anchor(hash) { return CFG.hub ? hash : HOME + hash; }

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  /* 「（草稿）」小签：树里带 draft 的条目自带一枚，挂在名字后面。
     挂小签而不是直接写进 text —— 侧栏文字位窄（「护岸整体稳定计算书」本来就靠
     省略号收尾），把后缀拼进名字里，长名字一截断就正好把后缀截掉，等于没加。 */
  function draftTag() { return el('span', 'lk-nav-tag', '（草稿）'); }

  function navItem(it) {
    var a = el('a', 'lk-nav-item' + (it.on ? ' on' : ''));
    a.href = it.href || '#';
    if (it.key) a.dataset.k = it.key;
    // 纯下载条目（zip）：补 download 属性，点了落下载而不是跳走
    if (it.dl) a.setAttribute('download', '');
    if (it.title || it.text) a.title = it.title || it.text;
    var ic = el('span', 'lk-nav-ic');
    ic.dataset.ic = it.ic || 'table';
    a.appendChild(ic);
    a.appendChild(el('span', 'lk-nav-txt', it.text || ''));
    if (it.draft) a.appendChild(draftTag());
    return a;
  }

  /* ---------- 顶栏下的同级标签带（知识库「总 + 各区」互跳） ----------
     本页 CFG.page 在树里那条带 tab 字段（总库和九个区，区条目 tabOnly 不进
     侧栏）时，把同板块里所有带 tab 的条目渲染成一条标签带：点哪个去哪个区，
     当前区高亮。清单永远从树里派生——树加区、改顺序，标签带自动跟，不用再改页面。
     海塘知识库没给 tab，所以它不进也不带这条带。区页直开自己端口时挂的是
     涉河小站那棵树（没有 tab 字段），标签带自然不出现，跟 cat:'kb' 一个逻辑。
     2026-10-21 用户定：水利规划页首标签带删除（地图点区名即达）。闸门：同组
     不足两个 tab 就不出带——现在只剩 allwater 一个 tab，条带永远不渲染；
     allwater.tab 字段保留，railKey 还要靠它把区页高亮归到「水利规划」。 */
  function buildSectionTabs() {
    if (!CFG.page) return null;
    var cur = null, sec = null;
    SITE.forEach(function (t) {
      (t.items || []).forEach(function (it) {
        if (it.key === CFG.page && it.tab) { cur = it; sec = t; }
      });
    });
    if (!cur) return null;
    var nTab = 0;
    (sec.items || []).forEach(function (it) { if (it.tab) nTab++; });
    if (nTab < 2) return null;
    var strip = el('div', 'lk-top-tabs');
    (sec.items || []).forEach(function (it) {
      if (!it.tab) return;
      var a = el('a', 'lk-tab' + (it === cur ? ' on' : ''));
      a.href = it.href || anchor(it.hash);
      a.textContent = it.tab;
      a.title = it.title || it.text || '';
      strip.appendChild(a);
    });
    return strip;
  }

  /* ---------- tabOnly 条目在侧栏里归谁 ----------
     区条目（tabOnly）不进侧栏，但落在区页上时侧栏不能两眼一抹黑：高亮和板块
     展开都归到同组里那个看得见的带 tab 条目（按钮名「水利规划」）上。
     本页条目不在树里、或自己就上侧栏，原样返回。 */
  function railKey(page) {
    if (!page) return page;
    var sec = null, cur = null;
    SITE.forEach(function (t) {
      (t.items || []).forEach(function (it) {
        if (it.key === page) { sec = t; cur = it; }
      });
    });
    if (!cur || !cur.tabOnly) return page;
    var vis = null;
    (sec.items || []).forEach(function (it) {
      if (it.tab && !it.tabOnly && !vis) vis = it.key;
    });
    return vis || page;
  }

  /* ---------- 全站导航：三大板块 + 可展开的工具清单 ----------
     两条铁律，导航才不会自己乱动：
     1) 展开/收起只由用户点击决定。滚动、跳锚点一律不碰展开状态——原来滚动高亮
        顺手调了收放，滚过几个板块就连着开开关关，看起来就是导航在抽搐。
     2) 不做「同时只展开一个」的手风琴。展开另一个板块时不去关掉已经展开的那个，
        用户没点的地方就不该动。
     展开状态存在 sessionStorage 里，跨页面（每个子服务都是整页跳转）保持不变，
     换页时左边这棵树看着是连续的，不会每进一个页面就重排一次。 */
  var OPEN_KEY = 'lk-nav-open';
  var opens = {};                        // key -> set(on)

  /* 「程序自己在滚」的那段时间里，滚动高亮先让位：这种滚动途中会横穿好几个板块，
     让 spy 照单全收的话，蓝底一路乱窜，最后还未必停在点的那一条上。
     两处要上锁：点导航后的平滑滚动、以及带 #xxx 打开页面时浏览器的锚点跳转。

     解锁只是「把判定权还回去」，不顺手重算一次——**你点的那一条就该一直亮着，
     直到你自己滚开为止**。重算会跟点击打架：最后一块比剩下的可滚动高度还靠下，
     永远顶不到判定线，只能靠「滚到底就算它」兜底。解锁后用户真滚了，scroll 事件
     自然会重新判定，不需要在这儿补一刀。

     解锁时机：scrollend（滚动真停下来）；用户中途自己滚轮/触摸就是接管了，也立刻
     解锁，别让高亮迟钝。掐表只是没有 scrollend 时的兜底。 */
  var spyLock = 0, spyTimer = 0;
  function lockSpy(ms) {
    spyLock = Date.now() + ms;
    clearTimeout(spyTimer);
    spyTimer = setTimeout(releaseSpy, ms);
  }
  function releaseSpy() {
    spyLock = 0;
    clearTimeout(spyTimer);
  }

  function markActiveTop(key) {
    [].forEach.call(document.querySelectorAll('.lk-top-item'), function (a) {
      a.classList.toggle('on', a.dataset.k === key);
    });
  }

  function readOpen() {
    try {
      var v = JSON.parse(sessionStorage.getItem(OPEN_KEY));
      // 存的格式是 [key,...]；格式换了/数据坏了的旧存档一律当没有，别让建导航时崩掉
      return Array.isArray(v) ? v : null;
    } catch (e) { return null; }
  }
  function saveOpen() {
    var on = Object.keys(opens).filter(function (k) { return opens[k].isOpen(); });
    try { sessionStorage.setItem(OPEN_KEY, JSON.stringify(on)); } catch (e) {}
  }
  function syncOpen() {
    Object.keys(opens).forEach(function (k) { opens[k].sync(); });
  }

  function buildNav(nav) {
    nav.appendChild(el('div', 'lk-rail-lbl', CFG.siteLbl || '功能板块'));
    var pageItem = null;   // 树里本页自己的条目，groups 的页内锚点要挂在它后面

    /* 当前页所属的板块：树是唯一一份站点地图，page 在树里实际挂在哪个板块下，
       就按哪个算——页面自己报的 cat 只当树里找不到时的退路。这样页面 cat 报错
       （护岸彩图一度报成 agent）也不会「进页面就把错的板块强制展开」；
       树里工具都在顶层、没有工具清单的小树（涉河那棵）自然落回 cat。 */
    var pageSec = CFG.cat || null;
    var pageRail = railKey(CFG.page);   // 本页在侧栏里该亮的那条（区页归到总库）
    if (CFG.page) {
      SITE.forEach(function (t) {
        if (!(t.items || []).some(function (it) { return it.key === pageRail; })) return;
        pageSec = t.key;
      });
    }

    SITE.forEach(function (top) {
      var a = navItem({
        key: top.key, text: (top.num ? top.num + ' ' : '') + top.text, ic: top.ic,
        // 顶层要么是板块（跳首页对应锚点），要么直接就是一个工具（自带 href）。
        // 涉河那棵小树没有「板块」这一层，顶层就是工具，所以 href 优先。
        href: top.href || anchor(top.hash),
        // 板块本身高亮只在工作台首页上用（子页面高亮的是下面那一条工具）；
        // 顶层直接是工具时，就按 page 高亮它自己
        on: top.href ? CFG.page === top.key : (!CFG.page && CFG.cat === top.key)
      });
      a.classList.add('lk-top-item');
      nav.appendChild(a);

      /* 点箭头 = 只展开/收起，不跳转；点板块名 = 跳到首页对应板块，顺手展开它。
         两种情况都只动自己这一组，不去关别人。
         这段必须绑在下面 `if (!top.items) return;` 之前：顶层条目不一定有工具清单
         （涉河小站那棵树顶层直接就是工具），没有的话原来走不到绑定这一步，
         点它们既没有即时高亮也不上锁，蓝底只能等平滑滚动
         途中被滚动高亮一路扫着改——看着就是先蹿到别的板块再落下来。
         opens[top.key] 是同一轮循环稍后才填的，但这里只在点击时才去取，不影响。 */
       a.addEventListener('click', function (e) {
         var g = opens[top.key];          // 没有工具清单的板块取不到，就是 undefined
         if (g && e.target.closest('.lk-nav-arrow')) {
           e.preventDefault();
           e.stopPropagation();
           g.set(!g.isOpen(), true);
           saveOpen();
           return;
         }
         if (g && !g.isOpen()) { g.set(true, true); saveOpen(); }
         // 首页里点板块是同页锚点跳转：立刻把蓝底落在点的这一条上，并让滚动高亮
         // 先停一会儿，别在跳转途中被中间横穿的板块抢走
         if (CFG.hub) {
           markActiveTop(top.key);
           lockSpy(1200);
           // 首页的左导航在封面状态下是收起的，平滑滚动途中会穿过封面阈值，
           // 导航一收一放会挤正文宽度，把滚动位置拽偏（就是"先蹿到主页再下来"那下抽搐）。
           // 这里发个事件，让首页自己的封面收放逻辑暂时让位，等滚动真停下来再重新判定。
           try {
             document.dispatchEvent(new CustomEvent('lk-rail-navigate', {
               detail: { target: top.key, duration: 1200 }
             }));
           } catch (err) {}
         }
       });

      if (!top.items) return;

      a.classList.add('has-sub');
      a.appendChild(el('span', 'lk-nav-arrow'));

      var sub = el('div', 'lk-sub');
      top.items.forEach(function (it) {
        // tabOnly 条目只喂页首标签带，不进侧栏（九个区）；区页的高亮归到总库
        if (it.tabOnly) return;
        var s = navItem({
          // title 要透传：导航栏文字位窄，长名字会被省略号截掉，
          // 全称只能靠悬停的 title 看（没写 title 的条目 navItem 会退回用 text）
          text: it.text, title: it.title, ic: it.ic,
          href: it.href || anchor(it.hash),
          dl: it.dl,
          // draft：条目自己标了，或者整个板块都没定稿（板块里每个工具都算）
          draft: it.draft || top.draft,
          on: pageRail === it.key
        });
        s.classList.add('lk-sub-item');
        sub.appendChild(s);
        if (it.key === CFG.page) pageItem = s;
      });
      nav.appendChild(sub);

      // 高度用真实内容高度，不用 CSS 里拍一个够大的 max-height：
      // 拍大值时过渡曲线跑的是「0 → 420px」，而内容只有 136px，动画会在看得见的
      // 部分早早结束、剩下的时间在空跑，收起时又要先空跑一段才开始动，很别扭。
      function measure() { return sub.scrollHeight + 'px'; }

      function set(on, animate) {
        if (!animate) sub.style.transition = 'none';
        a.classList.toggle('open', on);
        sub.classList.toggle('open', on);
        sub.style.maxHeight = on ? measure() : '0px';
        if (!animate) {
          sub.offsetHeight;                 // 刷新一次布局，免得下一帧把上面那步也补成动画
          sub.style.transition = '';
        }
      }

      opens[top.key] = {
        set: set,
        isOpen: function () { return a.classList.contains('open'); },
        // buildNav 跑的时候整个导航还没插进文档，scrollHeight 量出来是 0，
        // 展开的组会「有 open 类但高度为 0」＝看不见。插入之后必须再同步一次。
        // 窗口宽度跨过 980px 时行高会变（34px ↔ 38px），也用它重新量。
        sync: function () {
          if (a.classList.contains('open')) set(true, false);
        }
      };

      // 首屏状态：上次留在 sessionStorage 里的那几个 + 当前页所属板块（一定展开，
      // 板块按上面 pageSec 算：page 在树里的实际位置优先于页面报的 cat）。
      // 都是 animate=false，进页面时直接就是最终形态，不播一段展开动画。
      var saved = readOpen();
      var openNow = pageSec === top.key ||
        (saved ? saved.indexOf(top.key) >= 0 : false);
      set(openNow, false);
      if (pageSec === top.key) a.classList.add('cur');
    });

    /* 「本页目录」不再单独占顶部一节：组里的页内锚点降成三级条目（.lk-l3），
       挂在树里本页自己的条目后面（高程云图的两个云图锚点就跟在
       「高程云图生成器」名下），层级顺着树走：板块 → 工具 → 页内锚点，
       不在侧栏最顶上另立山头。本页条目的高亮也让给三级条目，不然父子两条一起蓝。
       树里找不到本页条目时才退回老样子，挂在导航末尾。 */
    var gItems = [];
    (CFG.groups || []).forEach(function (g) {
      (g.items || []).forEach(function (it) { gItems.push(it); });
    });
    if (gItems.length && pageItem && pageItem.parentNode) {
      pageItem.classList.remove('on');
      var ref = pageItem.nextSibling;      // 逐条插在原下一条前面，保持 groups 里的顺序
      gItems.forEach(function (it) {
        var s = navItem(it);
        s.classList.add('lk-sub-item', 'lk-l3');
        pageItem.parentNode.insertBefore(s, ref);
      });
    } else {
      (CFG.groups || []).forEach(function (g) {
        if (!g.items || !g.items.length) return;
        if (g.label) nav.appendChild(el('div', 'lk-rail-lbl', g.label));
        g.items.forEach(function (it) { nav.appendChild(navItem(it)); });
      });
    }
  }

  /* ============================================================
     任务守卫：这一页正在跑任务、或者刚跑完出了结果时，
     点左边导航去别的工具 —— 新开一个标签页，本页原样留着。

     缘由：全站是整页跳转，导航一点当前页就没了。而这些工具动辄跑好几分钟
     （护岸出文字 3~6 分钟、涉河读图更久），跑完的结果也大多只活在页面里
     （没落盘、刷新就没）。手滑点一下导航，跑了半天的东西就被盖掉了。

     怎么知道「有任务」：不改任何页面，外壳自己看网络。
       · 只统计**用户动过手之后**发出的请求（首次 pointerdown/keydown 之后）。
         页面一打开就拉的那些 api/env、配置、列表不算，否则一进页面就是「有结果」。
       · 有请求在飞  → busy（运行中）。轮询进度的 GET 也算，这本来就说明任务在跑。
       · 请求回来了，且是 POST/PUT/… 这类会干活的，或者是跑了 2.5 秒以上的长请求
         → done（已出结果），一直保持到这一页被关掉。
       · SSE（EventSource）连着就算 busy，断开算出了结果 —— 开思考链读图那种
         一跑十分钟的流式任务走的就是这条。
     页面要自己说了算，就调 LK.task('busy'|'done'|'idle')；调过一次之后
     外壳就不再自动判定，全听页面的。整页不想要守卫：LK_SHELL.guard = false。

     只守住左侧导航（含左上角回工作台的 logo）。页内锚点、展开箭头、
     用户自己按住 Ctrl/中键点开的，都不碰。
     ============================================================ */
  var GUARD_ON = CFG.guard !== false;
  var LONG_MS = 2500;                 // 超过这么久才回来的请求，算「干了活」
  var inflight = 0, hasResult = false, touched = false;
  var manual = null;                  // 页面调过 LK.task() 之后就固定听它的
  var chip = null;

  function taskState() {
    if (manual) return manual;
    if (inflight > 0) return 'busy';
    return hasResult ? 'done' : 'idle';
  }

  function renderTask() {
    var st = taskState();
    document.documentElement.dataset.lkTask = st;
    if (!chip) return;
    chip.hidden = st === 'idle';
    chip.className = 'lk-task ' + st;
    chip.textContent = st === 'busy' ? '任务运行中' : '已出结果';
    chip.title = '这一页' + (st === 'busy' ? '正在跑任务' : '刚出了结果') +
      '，点左侧导航会新开一个标签页，不会把这一页盖掉。';
  }

  function setTask(st) {
    manual = (st === 'busy' || st === 'done') ? st : 'idle';
    renderTask();
  }

  // 只在「守卫开着 + 没被页面接管 + 用户动过手」时才统计
  function counting() { return GUARD_ON && !manual && touched; }

  function openReq(method) {
    if (!counting()) return null;
    var tk = { m: String(method || 'GET').toUpperCase(), t0: Date.now() };
    inflight++;
    renderTask();
    return tk;
  }
  function closeReq(tk, ok) {
    if (!tk || tk.done) return;
    tk.done = true;
    if (inflight > 0) inflight--;
    var works = tk.m !== 'GET' && tk.m !== 'HEAD';
    if (ok && (works || Date.now() - tk.t0 >= LONG_MS)) hasResult = true;
    renderTask();
  }

  /* 网络三件套的包装。都是「原样转发 + 记个数」，不改任何行为，出错也照样抛给页面。
     app-shell.js 是 defer 脚本，页面自己写在 body 末尾的内联脚本比它先跑——但那些
     代码是在**调用时**才去取 window.fetch / XMLHttpRequest.prototype 的，所以后包
     也拦得住。 */
  function watchNet() {
    var W = window;

    ['pointerdown', 'keydown', 'submit', 'change'].forEach(function (t) {
      document.addEventListener(t, function () { touched = true; }, true);
    });

    if (typeof W.fetch === 'function') {
      var of = W.fetch;
      W.fetch = function (input, init) {
        var m = (init && init.method) ||
          (input && typeof input === 'object' && input.method) || 'GET';
        var tk = openReq(m), p;
        try { p = of.apply(this, arguments); }
        catch (e) { closeReq(tk, false); throw e; }
        if (!tk || !p || typeof p.then !== 'function') return p;
        return p.then(
          function (r) { closeReq(tk, true); return r; },
          function (e) { closeReq(tk, false); throw e; }
        );
      };
    }

    var XP = W.XMLHttpRequest && W.XMLHttpRequest.prototype;
    if (XP && XP.open && XP.send) {
      var oo = XP.open, os = XP.send;
      XP.open = function (m) {
        try { this.__lkM = m; } catch (e) {}
        return oo.apply(this, arguments);
      };
      XP.send = function () {
        var xhr = this, tk = openReq(xhr.__lkM);
        if (tk) {
          // loadend 无论成功/失败/abort 都会来一次；status>0 才算真收到了回应
          xhr.addEventListener('loadend', function () { closeReq(tk, xhr.status > 0); });
        }
        return os.apply(this, arguments);
      };
    }

    /* SSE：连着就算在跑。error 事件在自动重连时也会来，只有 readyState 变成
       CLOSED(2) 才是真断了；页面自己调 close() 也算结束。 */
    if (typeof W.EventSource === 'function') {
      var OE = W.EventSource;
      var ES = function (url, cfg) {
        var es = new OE(url, cfg), tk = openReq('SSE');
        if (tk) {
          var oc = es.close;
          es.close = function () { closeReq(tk, true); return oc.apply(this, arguments); };
          es.addEventListener('error', function () {
            if (es.readyState === 2) closeReq(tk, true);
          });
        }
        return es;                     // 构造函数返回对象，new ES() 拿到的就是它
      };
      ES.prototype = OE.prototype;     // instanceof EventSource 仍然成立
      ES.CONNECTING = 0; ES.OPEN = 1; ES.CLOSED = 2;
      W.EventSource = ES;
    }
  }

  /* ---------- 提示条 ---------- */
  var toastBox = null, toastTimer = 0;
  function toast(msg) {
    if (!toastBox) {
      toastBox = el('div', 'lk-toast');
      document.body.appendChild(toastBox);
    }
    toastBox.textContent = msg;
    toastBox.hidden = false;
    setTimeout(function () { toastBox.classList.add('on'); }, 20);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastBox.classList.remove('on');
      setTimeout(function () { if (toastBox) toastBox.hidden = true; }, 240);
    }, 4200);
  }

  /* ============================================================
     「（草稿）」小签

     还没定稿的工具，名字后面挂一枚「（草稿）」小签，提醒用的人结果可能还会变。
     挂不挂只看导航树里的 draft 标记：
       板块整块都没定稿的挂在板块上（engineering）
       板块正常、只有个别工具没定稿的挂在工具那一行上（calc 的三个计算器）

     小签出现在三处入口：左导航条目（navItem 里挂）、首页磁贴（.tile-name）、
     封面右侧功能面板条目（.nm）。后两处按 href 在文档里找齐 —— 树是唯一那份
     站点地图，加一条、改一条、把某条提去正式板块，小签自动跟着变，页面不用改。

     这里只管「标一下」，不拦人：2026-10-07 前后做过一版公网锁死（本机可用、
     发布到网上变灰点不动），同日按需求撤掉了，锁定相关的代码和样式都没留。
     ============================================================ */
  function normPath(href) {
    var p = String(href);
    try { p = new URL(p, location.href).pathname; } catch (e) {}
    try { p = decodeURIComponent(p); } catch (e) {}
    return p.replace(/\/index\.html?$/i, '/').replace(/\/+$/, '');
  }

  var DRAFT_PATHS = {};
  SITE.forEach(function (top) {
    (top.items || []).forEach(function (it) {
      if (!(top.draft || it.draft) || !it.href) return;
      DRAFT_PATHS[normPath(it.href)] = 1;
    });
  });

  /* 给正文里的入口挂小签。两处落法不一样：
     · 首页磁贴：挂在名字（.tile-name）里面，名字长了小签自己折到第二行；
     · 封面面板条目：一条只有 1/3 栏宽（约 140px），带括号的「（草稿）」一挂上去
       名字就只剩两个字，所以这里用短一截的「草稿」；而且必须挂在名字**外面** ——
       .nm 是省略号容器（overflow:hidden），挂进去会连小签一起被裁掉半截，
       看着就是一个空白小方块。
     左导航那条是 navItem 自己挂的，不走这儿。 */
  function tagDraftEntries() {
    if (!Object.keys(DRAFT_PATHS).length) return;
    [].forEach.call(document.querySelectorAll('a[href]'), function (a) {
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      if (!DRAFT_PATHS[normPath(href)]) return;
      if (a.querySelector('.tile-tag')) return;
      var nm = a.querySelector('.nm');            // 封面面板条目
      var box = nm || a.querySelector('.tile-name');
      if (!box) return;
      (nm ? a : box).appendChild(el('span', 'tile-tag', nm ? '草稿' : '（草稿）'));
    });
  }

  /* ---------- 拦下导航点击 ----------
     用捕获阶段绑在 .lk-rail 上：要赶在板块那个「展开 + 高亮」的处理器之前决定
     这一下到底是跳转还是新开。 */
  function guardRail(rail) {
    if (!GUARD_ON) return;
    // /xxx/ 和 /xxx/index.html 指的是同一页，比对之前先抹平
    function norm(p) { return p.replace(/\/index\.html?$/i, '/'); }
    rail.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      // 用户自己按修饰键 = 他本来就想新开/下载，别插手
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.target.closest('.lk-nav-arrow')) return;      // 点箭头只是展开
      var a = e.target.closest('a.lk-nav-item, a.lk-rail-logo');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;        // 页内锚点，不会跳走

      var url;
      try { url = new URL(href, location.href); } catch (err) { return; }

      var st = taskState();
      if (st === 'idle') return;

      var name = (a.querySelector('.lk-nav-txt') || {}).textContent || '工作台';

      /* 指向的就是当前这一页（导航里高亮那条、或者左上角 logo 停在工作台时）：
         默认行为是**重新加载**，跑着的任务照样没了，所以这一下也得拦。
         /xxx/ 和 /xxx/index.html 是同一页，比之前先抹平。 */
      if (url.origin === location.origin && url.search === location.search &&
          norm(url.pathname) === norm(location.pathname)) {
        e.preventDefault();
        e.stopPropagation();
        toast('「' + name + '」就是当前这一页——这一页' +
              (st === 'busy' ? '还在跑任务' : '刚出的结果') + '，没给你重新加载。');
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      var w = window.open(url.href, '_blank');
      if (w) {
        toast('已在新标签页打开「' + name + '」——这一页' +
              (st === 'busy' ? '还在跑任务' : '刚出的结果') + '，给你留着。');
        return;
      }
      /* 弹窗被浏览器拦了：只剩「就地跳走」一条路，那就问一句再走，
         别默默把跑着的任务盖掉。 */
      if (confirm('浏览器拦了新标签页。这一页' +
            (st === 'busy' ? '还有任务在跑' : '刚出的结果还没保存') +
            '，确定要在当前页打开「' + name + '」吗？\n\n' +
            '（建议：先允许本站弹出窗口，或按住 Ctrl 再点导航）')) {
        location.href = url.href;
      }
    }, true);
  }

  /* ---------- 正文里的功能入口，同一套规矩 ----------
     首页磁贴（.tile）、封面「全部功能」面板（.qn-item）这些正文入口，原来是
     写死 target="_blank" 的：点一下不管三七二十一就多开一个窗口，点五个功能
     就攒五个标签页。已按需求把 target 摘掉——**平时就地跳转**，跟同一份磁贴
     在左导航里的行为对齐。

     但「正在跑任务时另开一个」这条不能只留给左导航：用户点的是首页磁贴，
     跳走同样会把首页盖掉。所以这里补一层同样的判断，接在点击的冒泡阶段
     （不抢捕获、不动别人的处理器，只在真要跳走时才接管）：
       · 这一页 idle            → 什么都不做，浏览器照常就地跳转；
       · 这一页 busy/done       → 拦下，新标签页打开，本页原样留着。
     只认「裸左键点链接」：带修饰键的（用户自己想新开）、带 download 的、
     写死了 target 的、页内锚点，一律不碰。 */
  function guardEntries() {
    if (!GUARD_ON) return;
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a.tile, a.qn-item');
      if (!a) return;
      if (a.hasAttribute('download') || a.hasAttribute('target')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;

      var st = taskState();
      if (st === 'idle') return;              // 平时：就地跳，不用拦

      var url;
      try { url = new URL(href, location.href); } catch (err) { return; }
      // 同一页就不折腾了，让他照常刷新/锚点定位
      if (url.origin === location.origin && url.search === location.search &&
          url.pathname.replace(/\/index\.html?$/i, '/') ===
          location.pathname.replace(/\/index\.html?$/i, '/')) return;

      e.preventDefault();
      var name = (a.querySelector('.tile-name') || a.querySelector('.nm') ||
                  a.querySelector('.qn-txt') || {}).textContent || '这个功能';
      name = String(name).replace(/\s+/g, ' ').trim() || '这个功能';
      var w = window.open(url.href, '_blank');
      toast(w
        ? '已在新标签页打开「' + name + '」——这一页' +
          (st === 'busy' ? '还在跑任务' : '刚出的结果') + '，给你留着。'
        : '浏览器拦了新标签页，没能打开「' + name + '」——先允许本站弹窗再试。');
    }, false);
  }

  /* ============================================================
     一键导入案例（顶栏 CFG.cases，配置写法见文件头）

     为什么要有它：每改一次工具就得重新试一遍，试一遍就得开文件夹、翻示例文件、
     拖进去、再把钻孔号那些参数敲一遍。这个按钮把这一段全省了，点完直接点「下一步」。

     怎么做到「跟自己拖进去一样」：
       1. 优先交给 lk-upload.js 注册过的那个拖拽区（LKUpload.feed），页面的 onFiles
          原样跑，页面一行都不用改；
       2. 页面没用 lk-upload（护岸彩图、坐标转换）就退回去直接往 <input type=file>
          里塞 —— DataTransfer 造一份 FileList，再补一次 change 事件。
     ============================================================ */

  /* 案例要投到哪个窗口：高程云图那页是外壳套 iframe，拖拽区在 iframe 里面
     （同源，所以能直接伸手进去拿）。其余页面就是本页自己。 */
  function caseCtx() {
    var C = CFG.cases || {};
    var w = window, d = document;
    if (C.frame) {
      var fr = document.querySelector(C.frame);
      if (!fr || !fr.contentDocument) throw new Error('页面还没加载完（' + C.frame + '），等一下再点');
      w = fr.contentWindow; d = fr.contentDocument;
    }
    return { win: w, doc: d };
  }

  function putFiles(ctx, sel, files) {
    var node = sel ? ctx.doc.querySelector(sel) : null;
    if (sel && !node) throw new Error('这一页上找不到 ' + sel + '，案例配置和页面对不上了');
    // 1. 页面用了 lk-upload：走它的投放口，等价于用户自己拖进这个区
    var LU = ctx.win.LKUpload;
    var fed = LU && LU.feed && LU.feed(files, node);
    if (fed) return fed;
    // 2. 没用的话：直接把 FileList 塞进 <input type=file>，再补一次 change
    var inp = node && node.tagName === 'INPUT' ? node
            : (node && node.querySelector('input[type=file]'))
              || ctx.doc.querySelector('input[type=file]');
    if (!inp) throw new Error('这一页没有能接文件的地方' + (sel ? '（' + sel + '）' : ''));
    var dt = new ctx.win.DataTransfer();
    files.forEach(function (f) { dt.items.add(f); });
    inp.files = dt.files;
    // Async uploaders publish their completion promise during change. Pages
    // without that optional contract keep the ordinary synchronous behavior.
    var ownedAwait = Object.prototype.hasOwnProperty.call(inp, 'lkAwaitImport');
    var oldAwait = inp.lkAwaitImport;
    var ownedPromise = Object.prototype.hasOwnProperty.call(inp, 'lkImportPromise');
    var oldPromise = inp.lkImportPromise;
    var pending;
    inp.lkAwaitImport = true;
    inp.lkImportPromise = null;
    try {
      inp.dispatchEvent(new ctx.win.Event('change', { bubbles: true }));
      pending = inp.lkImportPromise;
    } finally {
      if (ownedAwait) inp.lkAwaitImport = oldAwait;
      else delete inp.lkAwaitImport;
      if (!pending || typeof pending.then !== 'function') {
        if (ownedPromise) inp.lkImportPromise = oldPromise;
        else delete inp.lkImportPromise;
      }
    }
    if (pending && typeof pending.then === 'function') return pending;
  }

  /* 顺手把参数填上。input / textarea / select 写 value，勾选框写 checked；
     两个事件都补：页面监听 input 的和监听 change 的都有。 */
  function setFields(ctx, fields) {
    Object.keys(fields || {}).forEach(function (sel) {
      var node = ctx.doc.querySelector(sel);
      if (!node) return;                    // 页面改过版就跳过这一项，别为它整个失败
      var v = fields[sel];
      if (node.type === 'checkbox' || node.type === 'radio') node.checked = !!v;
      else node.value = v;
      ['input', 'change'].forEach(function (t) {
        node.dispatchEvent(new ctx.win.Event(t, { bubbles: true }));
      });
    });
  }

  function fetchCase(f) {
    return fetch(f.url).then(function (r) {
      if (!r.ok) throw new Error('取不到 ' + decodeURIComponent(f.url) + '（HTTP ' + r.status +
        '）—— 跑一次 python 示例文件包清单.py 就会生成');
      return r.blob();
    }).then(function (b) {
      var name = decodeURIComponent(f.url.split('/').pop());
      return { to: f.to || '', file: new File([b], name, { type: f.type || b.type }) };
    });
  }

  var caseBusy = false;
  function importCase(btn, txt, C) {
    if (caseBusy || btn.dataset.caseBlocked === 'true') return;
    C = C || CFG.cases || {};
    caseBusy = true;
    btn.dataset.caseImporting = 'true';
    btn.disabled = true;
    txt.textContent = '导入中…';
    return Promise.resolve().then(function () {
      var ctx = caseCtx();
      return Promise.all((C.files || []).map(fetchCase)).then(function (got) {
        /* 按投放口分组，组内保持配置里的先后顺序（页面靠这个顺序认第几张图）。
           serial：一个一个投、中间隔一下 —— 土层柱状图那页每张图是 FileReader 读完
           才落格子的，一起投的话小图先读完就抢到了第一格，顺序会反。 */
        var order = [], byTo = {};
        got.forEach(function (g) {
          if (!byTo[g.to]) { byTo[g.to] = []; order.push(g.to); }
          byTo[g.to].push(g.file);
        });
        return order.reduce(function (p, to) {
          return p.then(function () {
            var files = byTo[to];
            if (!C.serial) return putFiles(ctx, to, files);
            return files.reduce(function (q, f) {
              return q.then(function () {
                return Promise.resolve(putFiles(ctx, to, [f])).then(function () {
                  return new Promise(function (ok) { setTimeout(ok, 300); });
                });
              });
            }, Promise.resolve());
          });
        }, Promise.resolve());
      }).then(function () {
        setFields(ctx, C.fields);
        return Promise.resolve(typeof C.then === 'function' ? C.then(ctx.win, ctx.doc) : null).then(function () {
          toast('案例已导入' + (C.next ? '，' + C.next : '，直接点下一步就行'));
          return true;
        });
      });
    })['catch'](function (e) {
      toast('案例导入失败：' + ((e && e.message) || e));
      return false;
    }).then(function (result) {
      caseBusy = false;
      btn.dataset.caseImporting = 'false';
      btn.disabled = btn.dataset.caseBlocked === 'true';
      txt.textContent = '一键导入案例';
      return result;
    });
  }

  /* 多案例（CFG.cases 是数组）：按钮点开一个小菜单，列出每个案例的名字和文件，
     点哪个导哪个。单案例不走这儿 —— 按钮还是点一下直接导。
     菜单用 position:fixed 按按钮的视口坐标摆一次就够：顶栏不随正文滚，按钮不动。 */
  var caseMenu = null;
  function closeCaseMenu() {
    if (!caseMenu) return;
    caseMenu.remove();
    caseMenu = null;
    document.removeEventListener('click', onCaseDocClick, true);
    document.removeEventListener('keydown', onCaseEsc, true);
  }
  function onCaseDocClick(e) {
    if (caseMenu && !caseMenu.contains(e.target)) closeCaseMenu();
  }
  function onCaseEsc(e) { if (e.key === 'Escape') closeCaseMenu(); }

  function toggleCaseMenu(btn, list) {
    if (caseMenu) { closeCaseMenu(); return; }
    var m = el('div', 'lk-case-menu');
    list.forEach(function (C) {
      var item = el('button', 'lk-case-item');
      item.type = 'button';
      item.appendChild(el('span', 'lk-case-nm', C.name || '未命名案例'));
      var fls = (C.files || []).map(function (f) {
        return decodeURIComponent(String(f.url || '').split('/').pop());
      }).filter(Boolean).join('、');
      if (fls) item.appendChild(el('span', 'lk-case-fl', fls));
      item.addEventListener('click', function () {
        closeCaseMenu();
        importCase(btn, btn.querySelector('.lk-btn-tx'), C);
      });
      m.appendChild(item);
    });
    document.body.appendChild(m);
    var r = btn.getBoundingClientRect();
    m.style.top = (r.bottom + 6) + 'px';
    m.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    caseMenu = m;
    // 晚一拍再挂全局监听：现在这个 click 还在往外冒，立刻挂会把刚开的菜单当场关掉
    setTimeout(function () {
      document.addEventListener('click', onCaseDocClick, true);
      document.addEventListener('keydown', onCaseEsc, true);
    }, 0);
  }

  function build() {
    var doc = document;
    doc.documentElement.classList.add('lk');
    var dense = !CFG.hub && CFG.dense !== false;
    if (dense) doc.documentElement.classList.add('lk-dense');

    // ---- 左侧导航 ----
    var rail = el('div', 'lk-rail');
    var logo = el('a', 'lk-rail-logo');
    logo.href = HOME;
    logo.appendChild(el('span', 'lk-rail-mark'));
    logo.appendChild(el('span', 'lk-rail-name', CFG.name || '上咨设计'));
    rail.appendChild(logo);

    var nav = el('div', 'lk-rail-nav');
    buildNav(nav);
    rail.appendChild(nav);
    var foot = el('div', 'lk-rail-foot');
    foot.innerHTML = CFG.foot || '局域网内部使用<br>设计一院 · 施晓欢';
    rail.appendChild(foot);

    // ---- 顶栏 ----
    var headerTarget = CFG.headerTarget && doc.querySelector(CFG.headerTarget);
    var top = el('div', 'lk-top' + (headerTarget ? ' compact' : ''));
    if (CFG.brand && !headerTarget) {
      var img = el('img', 'lk-brand-logo');
      img.src = CFG.brand;
      img.alt = '上海上咨工程设计有限公司';
      top.appendChild(img);
    }
    if (!headerTarget) {
      var pageTitle = el('span', 'lk-title', CFG.title || doc.title);
      if (dense) pageTitle.title = [typeof CFG.tag === 'string' ? CFG.tag : '', CFG.desc || ''].filter(Boolean).join(' · ');
      top.appendChild(pageTitle);
    }
    if (CFG.tag && !headerTarget) {
      var tag = typeof CFG.tag === 'string' ? { text: CFG.tag } : CFG.tag;
      if (!dense || tag.warn) top.appendChild(el('span', 'lk-tag' + (tag.warn ? ' warn' : ''), tag.text));
    }
    /* 任务状态小灯：平时不出现，页面一开始跑任务/出了结果才亮。
       它就是「为什么点导航会新开标签页」的答案，鼠标移上去有说明。 */
    if (GUARD_ON) {
      chip = el('span', 'lk-task');
      chip.hidden = true;
      top.appendChild(chip);
    }
    // 一句话说明：没写就干脆不出这个节点。原来不管有没有都塞一个空 span，
    // 它带着 flex:1，顶栏里就多一段撑着的空白——各页面把 desc 收进「使用说明」
    // 之后，这个空节点会留在每一页上。
    if (CFG.desc && !headerTarget && !dense) top.appendChild(el('span', 'lk-desc', CFG.desc));

    var acts = el('div', 'lk-acts');
    /* 顶栏分两组：页面自己的工具条（.lk-slot）放左边，挨着标题 / 任务小灯这一组；
       从模型下拉开始的全局入口（案例 / 示例文件 / 使用说明 / 头像）留在 .lk-acts 里，
       靠 margin-left:auto 整体居右。 */
    var slot = el('div', 'lk-slot');
    top.appendChild(slot);

    /* 「主题」不在子页面出现：选择器只在首页封面顶栏那一处（.hub-theme-control），
       子页面开局把首页选的那套色套回本页就完事，顶栏不再多这一个按钮。 */

    /* 右上角模型选择下拉（CFG.modelSelect 配了才渲染）。
       宽度在 app-shell.css 里固定死，不随选项文字伸缩，也不会把旁边按钮挤走。
       页面可用 window.LKGetModel() 读当前值、window.LKSetModel(v) 回写。 */
    if (CFG.modelSelect) {
      (function () {
        var MS = CFG.modelSelect;
        var wrap = el('div', 'lk-model-select');
        var sel = doc.createElement('select');
        sel.className = 'lk-model-sel';
        sel.title = '选择使用的模型（切换后对下一次操作生效）';
        (MS.options || []).forEach(function (o) {
          var op = doc.createElement('option');
          op.value = o.value;
          op.textContent = o.label;
          if (o.value === MS.value) op.selected = true;
          sel.appendChild(op);
        });
        window.LKGetModel = function () { return sel.value; };
        window.LKSetModel = function (v) {
          for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === v) { sel.value = v; return true; }
          }
          return false;
        };
        sel.addEventListener('change', function () {
          if (typeof MS.onChange === 'function') MS.onChange(sel.value, sel);
        });
        wrap.appendChild(sel);
        acts.appendChild(wrap);
      })();
    }

    /* 「示例文件」：一份能直接跑通这个页面的案例包（示例输入 + README 使用说明）。
       用 <a download> 而不是按钮 —— 点了直接落到下载目录，不新开标签页，
       也不会因为浏览器认得 zip 就跳去预览。 */
    /* 「一键导入案例」排在「示例文件」前面：一个是**现在就拿来试**，一个是拿回去看，
       前者用得多得多。窄屏只留图标（见 app-shell.css 的 max-width:980px）。 */
    if (CFG.cases) {
      var caseList = Array.isArray(CFG.cases) ? CFG.cases : [CFG.cases];
      var cs = el('button', 'lk-btn case');
      cs.type = 'button';
      cs.title = '把示例文件直接放进上传区、参数也填好'
        + (caseList.length === 1
          ? (caseList[0].name ? '\n案例：' + caseList[0].name : '')
          : '\n本页有 ' + caseList.length + ' 个案例，点开挑一个');
      var cic = el('span', 'lk-btn-ic'); cic.dataset.ic = 'case';
      cs.appendChild(cic);
      var ctx0 = el('span', 'lk-btn-tx', '一键导入案例');
      cs.appendChild(ctx0);
      if (caseList.length > 1) {
        cs.addEventListener('click', function () { toggleCaseMenu(cs, caseList); });
      } else {
        cs.addEventListener('click', function () { importCase(cs, ctx0, caseList[0]); });
      }
      var caseTarget = CFG.caseTarget && doc.querySelector(CFG.caseTarget);
      (caseTarget || acts).appendChild(cs);
    }
    if (CFG.demo) {
      var dl = el('a', 'lk-btn demo');
      dl.href = CFG.demo;
      dl.setAttribute('download', '');
      dl.title = '下载示例文件（含 README 使用说明）';
      var dic = el('span', 'lk-btn-ic'); dic.dataset.ic = 'dl';
      dl.appendChild(dic);
      dl.appendChild(doc.createTextNode('示例文件'));
      acts.appendChild(dl);
    }
    if (CFG.doc) {
      var help = el('button', 'lk-btn help');
      help.type = 'button';
      var hic = el('span', 'lk-btn-ic'); hic.dataset.ic = 'help';
      help.appendChild(hic);
      help.appendChild(doc.createTextNode('使用说明'));
      help.addEventListener('click', function () { openDoc(); });
      acts.appendChild(help);
    }
    /* 「更新日志」：跟「使用说明」共用同一个抽屉，只是换一份页面和标题。
       只有配了 log 的页面才出这个按钮（现在是主站首页）。
       2026-10-12：按用户要求**只留图标、不放文字**（顶栏右上角要短），
       图标换成时钟跟「使用说明」的问号区分开；含义靠 title 悬停提示 +
       aria-label 兜住 —— 图标自己不带字，别让人猜。 */
    if (CFG.log) {
      var lg = el('button', 'lk-btn help ico');
      lg.type = 'button';
      lg.title = '更新日志';
      lg.setAttribute('aria-label', '更新日志');
      var lic = el('span', 'lk-btn-ic'); lic.dataset.ic = 'log';
      lg.appendChild(lic);
      lg.addEventListener('click', function () { openDoc(CFG.log, '更新日志'); });
      acts.appendChild(lg);
    }
    /* 「流量统计」：看反向代理日志里各功能被点了多少次（两台开发机已排除）。
       只在工作台首页出（CFG.hub）——子页面顶栏要保持干净，统计进去首页看就行。
       统计接口由代理自己答（/api/usage-stats），首页在 8000 入口后面直接有数据。
       同上：只留柱状图图标，字撤掉，title 里说清是什么。 */
    if (CFG.hub) {
      var us = el('button', 'lk-btn help ico');
      us.type = 'button';
      us.title = '流量统计';
      us.setAttribute('aria-label', '流量统计');
      var uic = el('span', 'lk-btn-ic'); uic.dataset.ic = 'score';
      us.appendChild(uic);
      us.addEventListener('click', function () { openStats(); });
      acts.appendChild(us);
    }
    top.appendChild(acts);

    // ---- 内容区：把原来 body 里的东西整体搬进来 ----
    var body = el('div', 'lk-body' + (CFG.pad === false ? '' : ' pad'));
    var keep = { SCRIPT: 1, STYLE: 1, LINK: 1, TEMPLATE: 1, NOSCRIPT: 1 };
    var moving = [];
    for (var i = 0; i < doc.body.childNodes.length; i++) {
      var n = doc.body.childNodes[i];
      if (n.nodeType === 1 && keep[n.tagName]) continue;
      moving.push(n);
    }
    moving.forEach(function (n) { body.appendChild(n); });

    var main = el('div', 'lk-main');
    if (headerTarget) headerTarget.appendChild(top);
    else main.appendChild(top);
    // 知识库区页的「总 + 各区」标签带：当前页在树里带 tab 字段才出现
    var tabStrip = buildSectionTabs();
    if (tabStrip) main.appendChild(tabStrip);
    main.appendChild(body);

    doc.body.insertBefore(main, doc.body.firstChild);
    doc.body.insertBefore(rail, main);

    // ---- 「（草稿）」小签 ----
    // 要在导航、正文都进了文档之后才挂：首页磁贴和封面功能面板条目都是正文的
    // 一部分，正文还没搬进 .lk-body 时按 href 找不到它们。
    tagDraftEntries();

    // 进了文档才量得到真实高度，把展开着的组补上（不带动画，第一帧就是最终形态）
    syncOpen();

    // 左导航滚动位置记忆（2026-10-12 定稿）。
    // 全站是整页跳转，左导航每页重建、滚动位置从 0 起步。第一版只做「把高亮条
    // 滚进可视区」，可那至多把条贴到可视区边上，跟手点时的位置对不上，看着就是
    // 「点完往上挪一段」。现在改成：滚到哪儿记到哪儿，下一页开局原样还原
    // —— 点哪个按钮，左导航就停在原处，纹丝不动。
    //   · 存 localStorage（跟主题一个路子）：直接开子服务自己端口时
    //     sessionStorage 是另一份，靠它跨端口兜住；还原时 clamp 到合法范围，
    //     各页导航树长短不一样也不会越界。
    //   · 从没滚过就没有记录，这时才退回「高亮条滚进可视区」，至少看得见当前页；
    //     注意只在实际滚动过之后才写值，否则一开局写个 0 就把这条退路堵死了。
    //   · 不能在 defer 阶段直接滚：后台标签页里整页还没做过第一次布局
    //     （documentElement.clientHeight 量出来是 0，.lk-rail-nav 只有十几像素高，
    //     算出的滚动目标是错的，等真实布局落定就成了一处没来由的偏移）。
    //     rAF 在后台页面里正好憋着不跑，页面真画出第一帧（布局就位）时才执行。
    //     clientHeight<30 说明布局还没就位，再等一帧；60 帧封顶免得死等。
    var NAV_SCROLL_KEY = 'sz-nav-scroll';
    (function navScroll(n) {
      if (nav.clientHeight < 30 && n < 60) {
        requestAnimationFrame(function () { navScroll(n + 1); });
        return;
      }
      var saved = 0;
      try { saved = parseInt(localStorage.getItem(NAV_SCROLL_KEY), 10) || 0; } catch (e) {}
      function apply(v) {
        var mx = nav.scrollHeight - nav.clientHeight;
        nav.scrollTop = Math.max(0, Math.min(v, mx));
      }
      if (saved > 0) {
        apply(saved);
      } else {
        var cur = nav.querySelector('.lk-nav-item.on');
        if (cur) cur.scrollIntoView({ block: 'center' });
      }
      // 布局晚半步才稳（字体、展开后的高度）：再校一次。用户自己动了就别抢。
      var touched = false;
      var evs = ['wheel', 'pointerdown', 'touchstart', 'keydown'];
      for (var i = 0; i < evs.length; i++) {
        nav.addEventListener(evs[i], function () { touched = true; }, { passive: true });
      }
      setTimeout(function () {
        if (touched || saved <= 0) return;
        apply(saved);
      }, 400);
      // 记住用户滚到哪儿，下一页开局原样还原。节流 200ms 省得滚动时猛写；
      // 但「滚完立刻点链接」时那次节流还没落盘，所以点导航和 pagehide 各补写一次
      // （pagehide 管 bfcache 那类不走 click 的离开，不用 beforeunload——
      // 挂它会让浏览器不敢进 bfcache，返回时整页重来）。
      function save() {
        try { localStorage.setItem(NAV_SCROLL_KEY, String(nav.scrollTop)); } catch (e) {}
      }
      var t;
      nav.addEventListener('scroll', function () {
        clearTimeout(t);
        t = setTimeout(save, 200);
      }, { passive: true });
      nav.addEventListener('click', save);
      window.addEventListener('pagehide', save);
    })(0);
    var rz;
    window.addEventListener('resize', function () {
      clearTimeout(rz);
      rz = setTimeout(syncOpen, 150);
    });

    // 页面自己的工具条搬进顶栏（搬的是同一个节点，已绑定的事件全都还在）
    if (CFG.actions) {
      var bar = doc.querySelector(CFG.actions);
      if (bar) slot.appendChild(bar);
    }

    // ---- 回到顶部 ----
    if (CFG.backTop) {
      var up = el('button', 'lk-totop', '↑');
      up.type = 'button';
      up.title = '回到顶部';
      body.appendChild(up);
      body.addEventListener('scroll', function () {
        up.classList.toggle('on', body.scrollTop > 360);
      });
      up.addEventListener('click', function () {
        body.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    /* ---- 带 #xxx 打开时的落点 ----
       外壳把正文搬进 .lk-body 之后，浏览器解析时做过的那次锚点跳转就白做了——它滚的是
       document，而现在真正在滚的是 .lk-body（scrollTop 还停在 0）。浏览器要等到 load
       之后才补跳一次，于是第一帧停在最上面（首页就是封面），随后才滑到目标块；.lk-body
       上又挂着 scroll-behavior:smooth，这段补跳是带动画的——从子页面点板块名回工作台时
       看到的「先到主页、再跳到板块」那下抽搐就是它。首页上还要更难看一点：这段滚动会先
       扫过 scrollTop<24 的区间，首页据此把左导航当成「停在封面」收起来，紧接着又展开。

       所以外壳自己把落点顶到位，而且必须是瞬时的：临时把 scroll-behavior 改成 auto
       （内联样式压得住 CSS 里的 smooth），定完位再还回去。这一步在 defer 脚本里跑完，
       正文又要等外壳给 <html> 加上 .lk 才显示（见 app-shell.css 的 lk-boot-reveal），
       所以画出来的第一帧就已经在目标块上了。

       用 scrollIntoView 而不是直接写 scrollTop：它跟浏览器自己那次跳转算的是同一个位置
       （都认目标块的 scroll-margin-top），这样 load 之后浏览器再补一次也是原地不动，
       不会为了差那几像素又滑一下。 */
    var want = (location.hash || '').slice(1);
    try { want = decodeURIComponent(want); } catch (e) {}
    var landing = want && doc.getElementById(want);
    if (landing && body.contains(landing)) {
      body.style.scrollBehavior = 'auto';
      landing.scrollIntoView({ block: 'start' });
      body.offsetHeight;                  // 落实这次定位，免得下一帧把它补成动画
      body.style.scrollBehavior = '';
    }

    // ---- 锚点滚动高亮（主站首页）----
    if (CFG.spy) spy(rail, body);

    // ---- 任务守卫 ----
    // guardRail 管左导航，guardEntries 管正文里的功能入口（首页磁贴 / 封面面板）
    if (GUARD_ON) { watchNet(); guardRail(rail); guardEntries(); }
    renderTask();

    window.LK = {
      rail: rail, top: top, body: body, slot: slot,
      openDoc: openDoc, closeDoc: closeDoc,
      // 页面要自己报状态就调它：LK.task('busy') / LK.task('done') / LK.task('idle')。
      // 调过一次之后外壳不再自动判定（见上面「任务守卫」）。
      task: setTask, taskState: taskState, toast: toast,
      // 页面想自己往上传区塞文件时用它（顶栏「一键导入案例」走的就是这条）
      putFiles: putFiles, caseCtx: caseCtx
    };
  }

  /* ---------- 「使用说明」抽屉 ----------
     「更新日志」走的也是这个抽屉：openDoc 收下要开哪一份，标题和 iframe 一起换。 */
  var drawer = null, frame = null, drawerTitle = null;
  function ensureDrawer() {
    if (drawer) return;
    drawer = el('div', 'lk-drawer');
    drawer.hidden = true;
    var mask = el('div', 'lk-drawer-mask');
    var panel = el('div', 'lk-drawer-panel');
    var head = el('div', 'lk-drawer-head');
    drawerTitle = el('b', null, '使用说明');
    head.appendChild(drawerTitle);
    head.appendChild(el('span', 'sub', CFG.title || ''));
    var x = el('button', 'lk-x', '×');
    x.type = 'button';
    x.title = '关闭（Esc）';
    head.appendChild(x);
    panel.appendChild(head);
    frame = el('iframe', 'lk-drawer-frame');
    frame.title = '使用说明';
    panel.appendChild(frame);
    drawer.appendChild(mask);
    drawer.appendChild(panel);
    document.body.appendChild(drawer);
    x.addEventListener('click', closeDoc);
    mask.addEventListener('click', closeDoc);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) closeDoc();
    });
  }
  function openDoc(src, label) {
    ensureDrawer();
    src = src || CFG.doc;
    label = label || '使用说明';
    drawerTitle.textContent = label;
    frame.title = label;
    // 第一次打开才加载；两份之间来回切时只在换了地址的时候重新载
    if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
    drawer.hidden = false;
    // 用 setTimeout 而不是 requestAnimationFrame：页面在后台标签页时 rAF 会被暂停，
    // 抽屉就永远停在屏幕外的初始位置了
    setTimeout(function () { drawer.classList.add('on'); }, 20);
  }
  function closeDoc() {
    if (!drawer) return;
    drawer.classList.remove('on');
    setTimeout(function () { drawer.hidden = true; }, 220);
  }

  /* ---------- 「流量统计」弹窗 ----------
     数据来自反向代理的使用日志：proxy.py 自己答 /api/usage-stats，汇总口径
     （点击=打开页面+操作+下载、轮询不计、开发机按 使用日志_排除开发机.json
     排除）见 _usagelog.usage_stats。这里只管把 JSON 画成表。
     全程 DOM 拼装不走 innerHTML 模板：设备列里有反查来的主机名，别给它拼串的机会。 */
  var statsBox = null;

  function closeStats() {
    if (!statsBox) return;
    statsBox.classList.remove('on');
    setTimeout(function () { statsBox.hidden = true; }, 160);
  }

  function ensureStats() {
    if (statsBox) return;
    statsBox = el('div', 'lk-stats');
    statsBox.hidden = true;
    var mask = el('div', 'lk-stats-mask');
    var panel = el('div', 'lk-stats-panel');
    var head = el('div', 'lk-stats-head');
    head.appendChild(el('b', null, '流量统计'));
    head.appendChild(el('span', 'sub'));
    var seg = el('div', 'lk-stats-seg');
    /* 近1天 = 从现在往前推 24 小时（后端按 days 直接往前减，days=1 就是这一天）。
       排在最前：日常要看的就是「今天谁在用」，口径跟 KPI 里的「今日点击」对得上。 */
    [['1', '近1天'], ['7', '近7天'], ['30', '近30天'], ['0', '全部']].forEach(function (p) {
      var b = el('button', null, p[1]);
      b.type = 'button';
      b.dataset.days = p[0];
      b.addEventListener('click', function () {
        statsBox.dataset.days = p[0];
        [].forEach.call(seg.children, function (c) { c.classList.toggle('on', c === b); });
        loadStats(p[0]);
      });
      seg.appendChild(b);
    });
    head.appendChild(seg);
    var x = el('button', 'lk-stats-x', '×');
    x.type = 'button';
    x.title = '关闭（Esc）';
    x.addEventListener('click', closeStats);
    head.appendChild(x);
    panel.appendChild(head);
    panel.appendChild(el('div', 'lk-stats-sum'));
    panel.appendChild(el('div', 'lk-stats-body'));
    panel.appendChild(el('div', 'lk-stats-foot'));
    statsBox.appendChild(mask);
    statsBox.appendChild(panel);
    document.body.appendChild(statsBox);
    mask.addEventListener('click', closeStats);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !statsBox.hidden) closeStats();
    });
  }

  function openStats() {
    ensureStats();
    statsBox.hidden = false;
    // 跟抽屉同一招用 setTimeout 不用 rAF：后台标签页里 rAF 憋着不跑，动画起始态就停住了
    setTimeout(function () { statsBox.classList.add('on'); }, 15);
    var want = statsBox.dataset.days || '0';
    [].forEach.call(statsBox.querySelectorAll('.lk-stats-seg button'), function (c) {
      c.classList.toggle('on', c.dataset.days === want);
    });
    loadStats(want);
  }

  function loadStats(days) {
    var box = statsBox;
    box.querySelector('.lk-stats-body').innerHTML = '<div class="lk-stats-note">正在算…</div>';
    box.querySelector('.lk-stats-sum').innerHTML = '';
    box.querySelector('.lk-stats-foot').innerHTML = '';
    fetch('/api/usage-stats?days=' + days).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) { drawStats(box, d); }).catch(function () {
      box.querySelector('.lk-stats-body').innerHTML =
        '<div class="lk-stats-err">拿不到统计数据。统计接口挂在统一入口（反向代理 8000 端口）上，'
        + '这个页面不是从它后面打开的——从首页进任意工具页，再点顶栏「流量统计」就能看到。</div>';
    });
  }

  function drawStats(box, d) {
    var sum = box.querySelector('.lk-stats-sum');
    [['点击合计', d.totalClicks], ['今日点击', d.todayClicks],
     ['用过的设备', d.devices], ['已排除开发机记录', d.excluded]].forEach(function (p) {
      var k = el('div', 'lk-stats-kpi');
      k.appendChild(el('b', null, (p[1] || 0).toLocaleString('zh-CN')));
      k.appendChild(el('span', null, p[0]));
      sum.appendChild(k);
    });
    box.querySelector('.lk-stats-head .sub').textContent =
      '口径：打开页面 + 点按钮 + 下载 · 开发机已排除 · 数据自 ' + (d.first || '').slice(0, 10);

    var body = box.querySelector('.lk-stats-body');
    if (!d.modules || !d.modules.length) {
      body.innerHTML = '<div class="lk-stats-note">这个时间段还没有使用记录。</div>';
    } else {
      var max = 0;
      d.modules.forEach(function (m) { if (m.clicks > max) max = m.clicks; });
      var tb = document.createElement('table');
      tb.className = 'lk-stats-tb';
      var thd = document.createElement('tr');
      [['rk', '排名'], ['nm', '子功能'], ['', '点击'], ['hs', '打开页面'], ['hs', '操作'],
       ['hs', '下载'], ['hs', '设备'], ['hs', '最近使用'], ['bar', '']].forEach(function (p) {
        var th = document.createElement('th');
        if (p[0]) th.className = p[0];
        th.textContent = p[1];
        thd.appendChild(th);
      });
      tb.appendChild(thd);
      d.modules.forEach(function (m, i) {
        var tr = document.createElement('tr');
        function td(cls, txt) {
          var c = document.createElement('td');
          if (cls) c.className = cls;
          c.textContent = txt;
          tr.appendChild(c);
          return c;
        }
        td('rk' + (i < 3 ? ' top' : ''), String(i + 1));
        td('nm', m.name);
        td('num', (m.clicks || 0).toLocaleString('zh-CN'));
        td('num hs', String(m.open || 0));
        td('num hs', String(m.act || 0));
        td('num hs', String(m.dl || 0));
        td('num hs', String(m.users || 0));
        td('hs', (m.last || '').slice(5, 16));
        var bar = document.createElement('td');
        bar.className = 'bar';
        var fill = document.createElement('div');
        fill.className = 'lk-stats-bar';
        var i2 = document.createElement('i');
        i2.style.width = (max ? Math.max(2, Math.round(m.clicks * 100 / max)) : 0) + '%';
        fill.appendChild(i2);
        bar.appendChild(fill);
        tr.appendChild(bar);
        tb.appendChild(tr);
      });
      body.innerHTML = '';
      body.appendChild(tb);
    }

    var foot = box.querySelector('.lk-stats-foot');
    foot.appendChild(el('div', 'lk-stats-note-s',
      '生成于 ' + (d.generated || '').slice(11) + ' · 异常请求不计入'));
    if (d.deviceList && d.deviceList.length) {
      var det = document.createElement('details');
      det.appendChild(el('summary', null, '按设备明细（' + d.deviceList.length + ' 台）'));
      var dt = document.createElement('table');
      dt.className = 'lk-stats-dev';
      var dtr = document.createElement('tr');
      ['设备', '记录数', '最近使用'].forEach(function (t, i2) {
        var th = document.createElement('th');
        th.textContent = t;
        if (i2 === 2) th.className = 'hs';
        dtr.appendChild(th);
      });
      dt.appendChild(dtr);
      d.deviceList.forEach(function (v) {
        var tr = document.createElement('tr');
        var c1 = document.createElement('td');
        c1.textContent = v.ip + (v.host ? '（' + v.host + '）' : '');
        tr.appendChild(c1);
        var c2 = document.createElement('td');
        c2.textContent = (v.count || 0).toLocaleString('zh-CN');
        tr.appendChild(c2);
        var c3 = document.createElement('td');
        c3.className = 'hs';
        c3.textContent = (v.last || '').slice(5, 16);
        tr.appendChild(c3);
        dt.appendChild(tr);
      });
      det.appendChild(dt);
      det.appendChild(el('div', 'lk-stats-note-s',
        '要把哪台机器也算成开发机，把它的 IP 或主机名加进平台根目录的「使用日志_排除开发机.json」，刷新即生效。'));
      foot.appendChild(det);
    }
  }

  /* ---------- 锚点滚动高亮 ----------
     只盯顶层板块（.lk-top-item）：展开出来的工具项里也可能有锚点（CAD插件下载
     指向板块内部的 #download），一起算会两条互相抢高亮。

     判定方式：当场量 .lk-body 的滚动位置，取「顶边已经划过去的最后一块」。
     判定线贴着视口上沿（+40px），不是放在视口中间：跳锚点是把目标块顶到上沿的，
     线放中间的话，遇上比半屏还矮的板块（01 板块只有 300 多 px），线会越过它落到
     下一块上——点 01 反而高亮 02。40 这个余量要大于 .section 的 scroll-margin-top
     （12px），否则跳过去正好差几像素，又会判成上一块。

     原来用的是 IntersectionObserver + 一张「谁还在判定带里」的表，取表里文档序
     最靠前的那块。问题出在这张表是攒出来的：观察器的通知是异步成批送的，快速滚动、
     左导航收放引起重排、锚点跳转，都可能让一批里混进已经过时的观测。只要有一条
     过时的「封面还在带里」被记进表，取文档序最靠前就取到封面 → 蓝底被拽到「主页」，
     等下一批到了再挪回来。那下没来由的闪跳就是它，也解释了为什么是偶发。
     按位置当场算没有历史状态，量到哪儿就是哪儿，不存在这个问题。

     **只改高亮，绝不碰展开状态。** 展开是用户点出来的，滚动是被动的，让被动的
     去改主动的结果，就成了导航自己在动。 */
  function spy(rail, body) {
    var links = [].slice.call(rail.querySelectorAll('.lk-top-item[href*="#"]'))
      .filter(function (a) { return a.getAttribute('href').charAt(0) === '#'; });
    if (!links.length) return;
    var secs = links.map(function (a) {
      return document.getElementById(a.getAttribute('href').slice(1));
    }).filter(Boolean);
    if (!secs.length) return;

    // 板块都是 .lk-body 的直接子节点，而 .lk-body 是 position:relative，
    // offsetParent 就是它，offsetTop 直接就是块在滚动容器里的位置，不用 getBoundingClientRect。
    function apply() {
      var line = body.scrollTop + 40;
      var hit = secs[0];
      for (var i = 0; i < secs.length; i++) if (secs[i].offsetTop <= line) hit = secs[i];
      // 滚到底了：最后一块可能比剩下的高度还矮，顶不到判定线，直接算它
      var atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 4;
      if (atEnd) hit = secs[secs.length - 1];
      // 还停在封面海报上、一块都没到：导航里没有「主页」条目了，一条都不点亮。
      // 只挡「一块都没到」的正常判定，别盖掉上面滚到底的直接算最后一块。
      if (!atEnd && hit.offsetTop > line) hit = null;
      markActiveTop(hit ? hit.id : null);
    }

    var tick = 0;
    body.addEventListener('scroll', function () {
      if (tick || spyLock) return;      // 锁着的时候不判定，解锁时 releaseSpy() 统一算一次
      tick = requestAnimationFrame(function () { tick = 0; apply(); });
    }, { passive: true });

    // 滚动真停下来就解锁；用户中途自己滚，说明他接管了，也立刻解锁
    if ('onscrollend' in window) body.addEventListener('scrollend', releaseSpy);
    body.addEventListener('wheel', releaseSpy, { passive: true });
    body.addEventListener('touchstart', releaseSpy, { passive: true });

    /* 带 #xxx 打开（从子页面点板块名回工作台就是这样）：先照 hash 把蓝底放到位再上锁，
       等浏览器把锚点跳转滚到位再判定。不然跳转执行之前内容还停在最顶上，这时候算一次
       就是「在封面」，蓝底先落到主页，滚到位又挪下来。跳转和这段 defer 脚本谁先谁后
       不一定，所以是偶发。 */
    var want = (location.hash || '').slice(1);
    if (want && secs.some(function (s) { return s.id === want; })) {
      markActiveTop(want);
      lockSpy(1200);
    } else {
      apply();
    }
  }

  /* ---------- 图标自检（治「图标时有时无」的灵异事件） ----------
     导航图标 = app-shell.css 里 .lk-nav-ic[data-ic=…] 一条条手写的规则，JS 这边
     只写 key，两边靠同步样式.py 保证一致。有两个口子会让图标变成一块空白：
     1) 加条目时 css 里漏了对应规则（map 图标当年就漏过，gear 也踩过一次）；
     2) 浏览器缓存了某个页面目录里的旧 css 副本——每个文件夹各有一份
        app-shell.css、URL 各不相同，子服务的 SimpleHTTP 又不发 no-cache，
        同步样式.py 更新后就「这页新、那页旧」，图标在这个页面有、到那个
        页面又没了。
     页面挂进文档、样式表到齐后巡一遍：有缺 → 先按本脚本自己的地址强拉一份
     同目录的最新 app-shell.css 注进 <style>（cache:'reload' 绕过缓存，顺手
     把缓存条目也换新，治上面第 2 类）；仍缺的（真漏了规则，第 1 类）就地给
     一枚中性兜底圆点，别留白块。控制台跑 window.LKShellIconsAudit() 可复查。 */
  var SHELL_SRC = (document.currentScript && document.currentScript.src) || '';
  /* 兜底圆点也分深浅两套：浅色导航条（白 / 粉）上白描边看不见，跟图标一个道理 */
  var FALLBACK_IC = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23@INK@' stroke-width='2' opacity='.5'%3E%3Ccircle cx='12' cy='12' r='5.5'/%3E%3C/svg%3E\")";
  function fallbackIcon() {
    var t = readTheme();
    return FALLBACK_IC.replace('@INK@', t === 'pink' ? '8C5E74' : (t === 'white' ? '5B708C' : 'fff'));
  }

  function missingIcons() {
    var bad = [];
    [].forEach.call(document.querySelectorAll('.lk-nav-ic[data-ic]'), function (ic) {
      if (!ic.style.backgroundImage && getComputedStyle(ic).backgroundImage === 'none') bad.push(ic);
    });
    return bad;
  }

  function auditIcons() {
    var bad = missingIcons();
    if (!bad.length) return;
    if (!SHELL_SRC) { patchFallback(bad); return; }
    // css 的地址按本脚本自己的 src 算：页面在哪个目录、走的哪个端口，
    // 拉到的都是它实际加载的那份副本，不会串到别的目录去
    fetch(new URL('app-shell.css', SHELL_SRC), { cache: 'reload' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (css) {
        var s = document.createElement('style');
        s.textContent = css;
        document.head.appendChild(s);
        // 注入的样式表要过一帧才进 computed
        return new Promise(function (res) { requestAnimationFrame(res); });
      })
      .then(function () { patchFallback(missingIcons()); })
      .catch(function () { patchFallback(bad); });
  }

  function patchFallback(list) {
    var ic = fallbackIcon();
    list.forEach(function (n) { n.style.backgroundImage = ic; });
  }
  window.LKShellIconsAudit = auditIcons;

  build();
  // load 事件后样式表都到齐了，才分得清「真缺规则」和「还没加载完」
  if (document.readyState === 'complete') requestAnimationFrame(auditIcons);
  else window.addEventListener('load', function () { requestAnimationFrame(auditIcons); });
})();
