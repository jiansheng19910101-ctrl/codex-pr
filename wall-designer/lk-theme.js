/* ============================================================
   上咨设计平台 · 全站主题（蓝 / 白 / 粉 / 金）· 首帧前引导

   —— 根目录这份是母版，每个页面目录下有一份同名副本；
      改完母版跑一次  python 同步样式.py  就全站生效。

   这份脚本必须**同步**加载在 <head> 里（不能加 defer，也不能放在 body 末尾）：
   它要在浏览器画出第一帧之前，把主题套到 <html data-hub-theme="…"> 上。
   否则换页时会先闪一下蓝色导航条再变成白 / 粉 —— app-shell.css 那两条画在
   <html> 上的「换页骨架」渐变用的就是 --lk-nav / --lk-bg，第一帧按默认值铺出来
   是深蓝的那条；蓝色主题正好，白 / 粉就得等 app-shell.js（defer）跑完才换过来。

   主题一共存三份，按这个顺序找：
     1) localStorage 的 sz-hub-theme —— 同源（协议+主机名+端口）最快的一份；
     2) cookie sz-hub-theme —— cookie 不分端口，直接开子服务端口（8035/8041…）
        进来时靠它（那种进法 localStorage 是另一份，读不到首页的选择）；
     3) 服务端副本（反向代理的 /api/hub-theme，存在站点根目录 hub_theme.json）
        —— 换浏览器、清了站点数据、或者这次 shixiaohuan:8000 下次 localhost:8000
        这种「主机名变了」的情况，前两份都丢了，只有这份还在。
   第 3 份要走网络，所以**只在本地两份都没有时才问**，而且是同步请求（局域网
   一次几毫秒），免得先铺一帧蓝色再变。取不到就按 blue 走，不拖慢页面。

   平时管主题的是 app-shell.js：顶栏「主题」按钮、首页封面上那个控件、跨标签
   同步都在那边，切换时会调 window.LKPushTheme 把选择也推到服务端那份上。
   ============================================================ */
(function () {
  var KEY = 'sz-hub-theme';
  var OK = ['blue', 'white', 'pink', 'gold'];
  var PORT = '8000';   // 统一入口（反向代理）的端口，主题的服务端副本在那儿

  function serverUrl() {
    try {
      return location.protocol + '//' + location.hostname + ':' + PORT + '/api/hub-theme';
    } catch (e) { return null; }
  }

  function readLocal() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    if (!v) {
      var m = document.cookie.match(/(?:^|;\s*)sz-hub-theme=([^;]*)/);
      if (m) { try { v = decodeURIComponent(m[1]); } catch (e2) { v = m[1]; } }
    }
    return OK.indexOf(v) >= 0 ? v : null;
  }

  // 同步问服务端：只在本地没存过时才走这条路，所以不影响绝大多数打开。
  function readServer() {
    var u = serverUrl();
    if (!u || !window.XMLHttpRequest) return null;
    try {
      var x = new XMLHttpRequest();
      x.open('GET', u, false);
      x.send();
      if (x.status === 200) {
        var j = JSON.parse(x.responseText);
        if (j && OK.indexOf(j.theme) >= 0) return j.theme;
      }
    } catch (e) {}
    return null;
  }

  function writeLocal(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    try {
      document.cookie = KEY + '=' + encodeURIComponent(v) +
        '; path=/; max-age=31536000; samesite=lax';
    } catch (e) {}
  }

  var local = readLocal();
  var v = local;
  var fromServer = false;
  if (!v) { v = readServer(); if (v) fromServer = true; }
  if (OK.indexOf(v) < 0) v = 'blue';
  // 从服务端找回来的那份要**写回本地**：下面 app-shell.js 开局还会按
  // localStorage / cookie 再套一次主题，不写回去它就把刚找回的值覆盖成蓝色了。
  if (fromServer) writeLocal(v);
  document.documentElement.setAttribute('data-hub-theme', v);

  // 把主题存到服务端那份上（异步，失败就当没这回事）。
  window.LKPushTheme = function (t) {
    if (OK.indexOf(t) < 0) return;
    var u = serverUrl();
    if (!u || !window.XMLHttpRequest) return;
    try {
      var x = new XMLHttpRequest();
      x.open('GET', u + '?set=' + encodeURIComponent(t), true);
      x.send();
    } catch (e) {}
  };
  // 本地这份是最新的（用户就在本机选的），顺手回推给服务端，让那份跟着更新。
  // 不然会出现：本机一直是粉色、服务端那份还停在旧的蓝色，等哪天本地读不到了，
  // 找回来的反而是旧的那个。
  if (local) window.LKPushTheme(local);
})();
