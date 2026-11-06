# 画护岸 · 参数化断面与三维 Demo

本目录为上咨设计「画护岸」的完整前端版本，基于最初的挡墙参数化代码扩展，界面和结果展示参照画桥单跨版。

## 运行

下载本仓库后，在仓库根目录运行：

```sh
python -m http.server 8080
```

访问 http://localhost:8080/wall-designer/index.html 。运行时不需要安装 Node.js、Python 第三方包或访问外部 CDN；Three.js 已随目录提供。Python 只用于静态托管，也可使用其他静态服务器。

这是平台内页面的原始版本，保留了上咨设计公共导航。独立运行时，其他工具的导航目标及平台主题服务未包含在本仓库；主题服务不可用会使用默认主题，不影响断面、三维或文件生成。中文文件名入口会跳转到 index.html，需保留整个目录，已不再是单文件页面。

## 功能

- 钢筋混凝土悬臂式、浆砌块石重力式两种护岸。
- 简版 8 项参数和详细尺寸；断面及三维模型实时联动。
- 二维断面节点拖动、方向键微调、Shift 精调，以及全图/放大查看。
- 墙体、基础和示意土体沿纵向拉伸固定 15 m；旋转、平移、缩放及预设视角。
- 可切换土体和示意水面，显示几何结构体积。
- 米制分层 DXF、SVG 断面、PNG 三维图及 JSON 参数导入/导出。
- 同一浏览器会话内从其他平台工作区返回时恢复参数与视角；刷新后重置。
- 兼容原 wall-dimensions v1 参数文件；未绘制的可选构造尺寸仅保留在参数文件内。

## 接入上咨设计

平台入口为「制图工具 → 画桥 → 画护岸」，页面路径 /wall/index.html。
[平台接入说明](integration/README.md) 和 [接入补丁](integration/platform.patch) 包含导航、图标、首页、主站静态映射和样式分发变更。

## 验证

Node.js 使用内置模块，Python 检查依赖仅用于验证 DXF，不是运行依赖：

```sh
node wall-designer/tests/audit-geometry.cjs
python -m pip install -r wall-designer/tests/requirements.txt
python wall-designer/tests/audit-dxf.py
```

几何、拖动、模式切换和 JSON 导入回滚 39 项检查通过；4 组 DXF 经 ezdxf 校验均为 0 errors / 0 fixes。开发时另检查 10 组土体多边形有效性、无穿墙与体积一致性，并实际检查桌面、390 px 窄屏、三维旋转、会话恢复和文件下载。

## 参数与使用范围

墙高为基础顶至墙顶的高度，坡比为竖向∶水平＝1∶m。土体展示底界取河底和基础底的较低值以下 1.5 m，并按当前墙前、墙后地形封闭；它是示意范围。可选水体高度用于表达河道侧，不是设计或实测水位。

当前为几何 demo，不包含稳定验算、配筋、完整施工构造或工程量审核。默认参数来自原 GitHub 实现；参考护岸图纸只用于构造关系，未作为尺寸依据。DXF 字体和目标 CAD 的显示效果仍需结合实际软件检查。

Three.js 使用 MIT 许可证，见 [vendor/three.LICENSE.txt](vendor/three.LICENSE.txt)。
