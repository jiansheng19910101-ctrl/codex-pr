/* 画护岸：由同一横断面拉伸的示意实体。长度 15 m，不作地质或结构验算。 */
(function () {
  'use strict';
  const LENGTH = 15;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function cleanRing(ring) {
    const points = ring.filter((p, i) => !i || Math.hypot(p[0] - ring[i - 1][0], p[1] - ring[i - 1][1]) > 1e-8);
    // A platform exactly at the footing top can retrace that top edge. Remove
    // the collinear intermediate vertices before triangulating the soil solid.
    let changed = true;
    while (changed && points.length > 3) {
      changed = false;
      for (let i = 0; i < points.length; i++) {
        const a = points[(i + points.length - 1) % points.length], b = points[i], c = points[(i + 1) % points.length];
        if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-9) {
          points.splice(i, 1); changed = true; break;
        }
      }
    }
    return points;
  }

  // Terrain follows the wall faces and the outside of the footing. The three
  // adjoining rings have disjoint interiors; none crosses the structural solid.
  function soilSections(g) {
    const { body, base, front, back, p } = g;
    const left = Math.min(...base.map(v => v[0]));
    const right = Math.max(...base.map(v => v[0]));
    const bottom = Math.min(p.river, p.baseBottom) - 1.5;
    const xmin = Math.min(front[0][0], left - .5);
    const xmax = Math.max(back.at(-1)[0], right + .5);
    return {
      bottom, xmin, xmax,
      front: cleanRing([[xmin, p.river], ...front, body[0], [left, g.z], [left, p.baseBottom], [left, bottom], [xmin, bottom]]),
      back: cleanRing([...back, [xmax, p.crest], [xmax, bottom], [right, bottom], [right, p.baseBottom], [right, g.z], body[1]]),
      below: [[left, bottom], [right, bottom], [right, p.baseBottom], [left, p.baseBottom]]
    };
  }

  class WallScene {
    constructor(container, options = {}) {
      this.host = container;
      this.onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
      this.disposed = false;
      this.ready = false;
      this.frame = 0;
      this.zoom = 1;
      this.theta = -.74;
      this.phi = .42;
      this.view = 'perspective';
      this.visibility = { soil: true, water: false };
      this.labels = [];
      this.listeners = [];
      this.activePointers = new Map();
      this.width = this.height = 1;
      this.originY = 0;
      container.style.position = 'relative';
      container.style.touchAction = 'none';
      container.tabIndex = container.tabIndex < 0 ? 0 : container.tabIndex;
      if (!window.THREE) { this.fail('三维组件未加载；仍可查看二维断面并导出 DXF。'); return; }
      this.T = window.THREE;
      const T = this.T;
      try {
        this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      } catch (_) {
        this.fail('当前浏览器未启用 WebGL，仍可查看二维断面。请开启硬件加速后刷新以显示三维。');
        return;
      }
      const renderer = this.renderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.16;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.canvas = renderer.domElement;
      this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
      this.canvas.setAttribute('role', 'img');
      this.canvas.setAttribute('aria-label', '护岸三维模型，纵向长 15 米。拖动旋转，滚轮缩放，Shift 或右键拖动平移。');
      container.append(this.canvas);
      this.scene = new T.Scene();
      this.scene.background = new T.Color(0xf3f6fa);
      this.camera = new T.OrthographicCamera(-20, 20, 12, -12, .01, 10000);
      this.center = new T.Vector3();
      this.pan = new T.Vector3();
      this.box = new T.Box3();
      this.direction = new T.Vector3();
      this.screenRight = new T.Vector3();
      this.screenUp = new T.Vector3();
      this.light = new T.DirectionalLight(0xfff6e9, 3.1);
      this.light.position.set(-18, 32, 22);
      this.light.castShadow = true;
      this.light.shadow.mapSize.set(1536, 1536);
      this.light.shadow.bias = -.0005;
      this.light.shadow.normalBias = .02;
      const fill = new T.DirectionalLight(0xdce8ff, 1.6);
      fill.position.set(20, 12, -16);
      this.scene.add(this.light, this.light.target, fill, new T.HemisphereLight(0xe4efff, 0xaa9279, 2.3));
      this.model = new T.Group();
      this.scene.add(this.model);
      this.tooltip = document.createElement('span');
      this.tooltip.className = 'wall-part-name';
      this.tooltip.style.cssText = 'position:absolute;left:12px;top:10px;padding:3px 8px;border:1px solid #dde4ed;border-radius:4px;background:#fffffff0;color:#49566a;font-size:12px;pointer-events:none;display:none;z-index:2';
      container.append(this.tooltip);
      this.raycaster = new T.Raycaster();
      this.pointer = new T.Vector2();
      this.pickable = [];
      this.bindInteractions();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
      this.listen(this.canvas, 'webglcontextlost', e => {
        e.preventDefault(); this.contextLost = true; this.ready = false;
        container.dataset.ready = 'false';
        this.onStatus('三维显示连接已中断，二维断面和导出仍可使用。');
      });
      this.listen(this.canvas, 'webglcontextrestored', () => {
        this.contextLost = false;
        if (this.geometry) this.update(this.geometry, this.type);
        this.resize();
      });
      this.resize();
    }

    fail(message) {
      this.host.dataset.ready = 'false';
      const el = document.createElement('div');
      el.className = 'wall-render-error';
      el.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:260px;padding:28px;text-align:center;font-size:13px;color:#68788c';
      el.textContent = message;
      this.host.append(el);
      this.errorElement = el;
      this.onStatus(message);
    }

    listen(el, name, callback, options) {
      el.addEventListener(name, callback, options);
      this.listeners.push(() => el.removeEventListener(name, callback, options));
    }

    clearModel() {
      for (const item of this.labels) item.el.remove();
      this.labels = [];
      this.pickable = [];
      if (!this.model) return;
      this.model.traverse(obj => {
        obj.geometry?.dispose();
        if (obj.material) for (const m of [].concat(obj.material)) m.dispose();
      });
      this.scene.remove(this.model);
      this.model = new this.T.Group();
      this.scene.add(this.model);
    }

    solid(ring, color, name, group, edges = true, opacity = 1) {
      const T = this.T;
      ring = cleanRing(ring);
      if (ring.length < 3) return null;
      const shape = new T.Shape();
      ring.forEach(([x, y], i) => i ? shape.lineTo(x, y - this.originY) : shape.moveTo(x, y - this.originY));
      shape.closePath();
      const geo = new T.ExtrudeGeometry(shape, { depth: LENGTH, bevelEnabled: false, steps: 1, curveSegments: 1 });
      geo.translate(0, 0, -LENGTH / 2);
      const material = new T.MeshStandardMaterial({ color, roughness: .87, metalness: .02, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
      const mesh = new T.Mesh(geo, material);
      mesh.userData = { name, color };
      mesh.castShadow = opacity >= 1;
      mesh.receiveShadow = true;
      group.add(mesh);
      this.pickable.push(mesh);
      if (edges) {
        const line = new T.LineSegments(new T.EdgesGeometry(geo, 28), new T.LineBasicMaterial({ color: 0x53647a, transparent: true, opacity: name.includes('土') ? .18 : .38 }));
        mesh.add(line);
      }
      return mesh;
    }

    line(points, color = 0x6383a6) {
      const T = this.T;
      const geo = new T.BufferGeometry().setFromPoints(points.map(p => new T.Vector3(...p)));
      const obj = new T.Line(geo, new T.LineBasicMaterial({ color, transparent: true, opacity: .8 }));
      this.model.add(obj);
      return obj;
    }

    label(text, position, kind = 'dimension') {
      const el = document.createElement('span');
      el.className = 'wall-scene-label';
      el.style.cssText = 'position:absolute;transform:translate(-50%,-50%);padding:2px 6px;border:1px solid #d2dce9;border-radius:4px;background:#fffffff0;color:#455874;font-size:11px;line-height:1.5;white-space:nowrap;pointer-events:none;z-index:1';
      el.textContent = text;
      this.host.append(el);
      this.labels.push({ el, position: new this.T.Vector3(...position), kind });
    }

    update(g, type = 'rc') {
      this.geometry = g;
      this.type = type;
      if (!this.renderer || this.disposed || this.contextLost) return;
      this.clearModel();
      this.originY = g.p.baseBottom;
      const T = this.T;
      const terrain = soilSections(g);
      this.soilGroup = new T.Group();
      this.waterGroup = new T.Group();
      this.model.add(this.soilGroup, this.waterGroup);
      this.solid(terrain.front, 0xc7b18c, '墙前土体（示意范围）', this.soilGroup, true);
      this.solid(terrain.back, 0xd0b88f, '墙后填土（示意范围）', this.soilGroup, true);
      this.solid(terrain.below, 0xbda783, '基础下土体（示意范围）', this.soilGroup, false);
      this.solid(g.base, 0xb9c4cf, '基础 · ' + g.B.toFixed(2) + ' m 宽', this.model);
      this.solid(g.body, type === 'stone' ? 0xa5a99f : 0x88a6c4, type === 'stone' ? '浆砌块石墙身' : '钢筋混凝土墙身', this.model);
      // Water is deliberately optional: its small depth illustrates the river
      // side only and is not a project design water level.
      const depth = Math.min(.45, (g.p.platform - g.p.river) * .25);
      const waterY = g.p.river + depth;
      const surfaceX = g.front[1][0] + depth * g.p.frontSlope;
      this.solid([[terrain.xmin, g.p.river], g.front[1], [surfaceX, waterY], [terrain.xmin, waterY]], 0x80bdd5, '示意水体（非设计水位）', this.waterGroup, false, .55);
      const floor = new T.Mesh(new T.PlaneGeometry(terrain.xmax - terrain.xmin + 4, LENGTH + 5), new T.ShadowMaterial({ color: 0x74859b, opacity: .12 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set((terrain.xmin + terrain.xmax) / 2, terrain.bottom - this.originY - .012, 0);
      floor.receiveShadow = true;
      this.model.add(floor);
      const dimensionX = Math.min(...g.base.map(p => p[0])) - .7;
      const dimensionY = g.p.platform - this.originY + .18;
      this.line([[dimensionX, dimensionY, -LENGTH / 2], [dimensionX, dimensionY, LENGTH / 2]]);
      for (const z of [-LENGTH / 2, LENGTH / 2]) this.line([[dimensionX - .18, dimensionY, z], [dimensionX + .18, dimensionY, z]]);
      this.label('墙段 15.00 m', [dimensionX - .2, dimensionY + .25, 0]);
      this.label('河道侧', [g.front[1][0] - .5, g.p.river - this.originY + .45, LENGTH / 2 + .35], 'side');
      this.label('堤顶侧', [g.back.at(-1)[0] - .6, g.p.crest - this.originY + .4, LENGTH / 2 + .35], 'side');
      this.label('墙高 ' + g.p.height.toFixed(2) + ' m', [(g.body[2][0] + g.body[3][0]) / 2, g.p.wallTop - this.originY + .5, LENGTH / 2], 'height');
      this.soilGroup.visible = this.visibility.soil;
      this.waterGroup.visible = this.visibility.water;
      // Bounds include the complete demonstration terrain even when hidden, so
      // toggling soil or water never makes the view unexpectedly jump.
      this.box.set(new T.Vector3(terrain.xmin, terrain.bottom - this.originY, -LENGTH / 2), new T.Vector3(terrain.xmax, Math.max(g.p.crest, g.p.wallTop) - this.originY, LENGTH / 2));
      this.box.getCenter(this.center);
      const extent = this.box.getSize(new T.Vector3()).length();
      const shadow = this.light.shadow.camera;
      shadow.left = shadow.bottom = -extent;
      shadow.right = shadow.top = extent;
      shadow.far = extent * 8;
      shadow.updateProjectionMatrix();
      this.light.position.copy(this.center).add(new T.Vector3(-extent, extent * 1.8, extent * 1.3));
      this.light.target.position.copy(this.center);
      this.ready = true;
      this.host.dataset.ready = 'true';
      this.host.dataset.length = String(LENGTH);
      this.onStatus('墙身、基础与土体沿纵向拉伸 15 m；土体边界为 demo 示意。');
      this.scheduleRender();
    }

    updateCamera() {
      const T = this.T;
      this.direction.set(Math.sin(this.theta) * Math.cos(this.phi), Math.sin(this.phi), Math.cos(this.theta) * Math.cos(this.phi));
      this.screenRight.crossVectors(new T.Vector3(0, 1, 0), this.direction).normalize();
      this.screenUp.crossVectors(this.direction, this.screenRight).normalize();
      let maxX = 0, maxY = 0;
      for (const x of [this.box.min.x, this.box.max.x]) for (const y of [this.box.min.y, this.box.max.y]) for (const z of [this.box.min.z, this.box.max.z]) {
        const delta = new T.Vector3(x, y, z).sub(this.center);
        maxX = Math.max(maxX, Math.abs(delta.dot(this.screenRight)));
        maxY = Math.max(maxY, Math.abs(delta.dot(this.screenUp)));
      }
      const aspect = this.width / this.height;
      this.halfHeight = Math.max(maxY, maxX / aspect, .5) * 1.18;
      Object.assign(this.camera, { left: -this.halfHeight * aspect, right: this.halfHeight * aspect, top: this.halfHeight, bottom: -this.halfHeight, zoom: this.zoom });
      this.camera.updateProjectionMatrix();
      const target = this.center.clone().add(this.pan);
      const distance = Math.max(180, this.box.getSize(new T.Vector3()).length() * 4);
      this.camera.far = distance * 4;
      this.camera.updateProjectionMatrix();
      this.camera.position.copy(target).addScaledVector(this.direction, distance);
      this.camera.lookAt(target);
      this.camera.updateMatrixWorld();
    }

    render() {
      this.frame = 0;
      if (!this.ready || this.disposed || this.contextLost || this.width < 2 || this.height < 2) return;
      this.updateCamera();
      this.renderer.render(this.scene, this.camera);
      const rect = this.host.getBoundingClientRect();
      for (const item of this.labels) {
        const v = item.position.clone().project(this.camera);
        const x = (v.x + 1) / 2 * this.width;
        const y = (1 - v.y) / 2 * this.height;
        item.el.style.display = v.z < -1 || v.z > 1 || x < 25 || x > rect.width - 25 || y < 14 || y > rect.height - 14 || (this.view === 'top' && item.kind === 'height') ? 'none' : '';
        item.el.style.left = x + 'px';
        item.el.style.top = y + 'px';
      }
    }

    scheduleRender() {
      if (!this.frame && !this.disposed) this.frame = requestAnimationFrame(() => this.render());
    }

    resize() {
      if (!this.renderer || this.disposed) return;
      const rect = this.host.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      this.width = rect.width; this.height = rect.height;
      this.renderer.setSize(this.width, this.height, false);
      this.scheduleRender();
    }

    setView(name) {
      this.view = ['perspective', 'front', 'side', 'top'].includes(name) ? name : 'perspective';
      this.zoom = 1; this.pan?.set(0, 0, 0);
      if (this.view === 'front') { this.theta = 0; this.phi = 0; }
      else if (this.view === 'side') { this.theta = -Math.PI / 2; this.phi = 0; }
      else if (this.view === 'top') { this.theta = 0; this.phi = Math.PI / 2 - .0001; }
      else { this.theta = -.74; this.phi = .42; }
      this.scheduleRender();
    }

    reset() { this.setView('perspective'); }

    setVisibility(next = {}) {
      for (const key of ['soil', 'water']) if (typeof next[key] === 'boolean') this.visibility[key] = next[key];
      if (this.soilGroup) this.soilGroup.visible = this.visibility.soil;
      if (this.waterGroup) this.waterGroup.visible = this.visibility.water;
      this.tooltip && (this.tooltip.style.display = 'none');
      this.scheduleRender();
    }

    gesture() {
      const p = [...this.activePointers.values()];
      if (!p.length) return null;
      if (p.length === 1) return { ...p[0], distance: 0 };
      return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2, pan: true, distance: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) };
    }

    doPan(dx, dy) {
      const scale = (this.halfHeight || 10) * 2 / this.height / this.zoom;
      this.pan.addScaledVector(this.screenRight, -dx * scale).addScaledVector(this.screenUp, dy * scale);
    }

    bindInteractions() {
      const canvas = this.canvas;
      this.listen(canvas, 'pointerdown', e => {
        if (![0, 1, 2].includes(e.button)) return;
        e.preventDefault(); this.host.focus({ preventScroll: true });
        canvas.setPointerCapture(e.pointerId);
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: e.button !== 0 || e.shiftKey });
        this.lastGesture = this.gesture();
        canvas.style.cursor = 'grabbing';
        this.tooltip.style.display = 'none';
      });
      this.listen(canvas, 'pointermove', e => {
        if (this.activePointers.has(e.pointerId)) {
          const old = this.activePointers.get(e.pointerId);
          this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: old.pan || e.shiftKey });
          const current = this.gesture(), previous = this.lastGesture;
          if (current && previous) {
            const dx = current.x - previous.x, dy = current.y - previous.y;
            if (current.pan) this.doPan(dx, dy);
            else { this.theta -= dx * .008; this.phi = clamp(this.phi + dy * .008, -1.48, 1.56); this.view = 'manual'; }
            if (current.distance && previous.distance) this.zoom = clamp(this.zoom * current.distance / previous.distance, .3, 6);
            this.scheduleRender();
          }
          this.lastGesture = current;
          return;
        }
        if (!this.ready) return;
        const rect = canvas.getBoundingClientRect();
        this.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const visible = this.pickable.filter(m => m.visible && m.parent.visible);
        const hit = this.raycaster.intersectObjects(visible, false)[0];
        this.tooltip.textContent = hit?.object.userData.name || '';
        this.tooltip.style.display = hit ? '' : 'none';
      });
      const end = e => {
        this.activePointers.delete(e.pointerId);
        this.lastGesture = this.gesture();
        if (!this.activePointers.size) canvas.style.cursor = 'grab';
      };
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this.listen(canvas, event, end);
      this.listen(canvas, 'pointerleave', () => { if (!this.activePointers.size) this.tooltip.style.display = 'none'; });
      this.listen(canvas, 'contextmenu', e => e.preventDefault());
      this.listen(canvas, 'wheel', e => { e.preventDefault(); this.zoom = clamp(this.zoom * Math.exp(-e.deltaY * .001), .3, 6); this.scheduleRender(); }, { passive: false });
      this.listen(this.host, 'keydown', e => {
        if (e.target !== this.host && e.target !== canvas) return;
        if (e.key === '0' || e.key === 'Home') { e.preventDefault(); this.reset(); return; }
        if (e.key === 'ArrowLeft') this.theta -= .12;
        else if (e.key === 'ArrowRight') this.theta += .12;
        else if (e.key === 'ArrowUp') this.phi = clamp(this.phi + .1, -1.48, 1.56);
        else if (e.key === 'ArrowDown') this.phi = clamp(this.phi - .1, -1.48, 1.56);
        else if (['+', '='].includes(e.key)) this.zoom = clamp(this.zoom * 1.12, .3, 6);
        else if (e.key === '-') this.zoom = clamp(this.zoom / 1.12, .3, 6);
        else return;
        this.view = 'manual'; e.preventDefault(); this.scheduleRender();
      });
    }

    capture() {
      if (!this.ready || this.contextLost) return null;
      this.render();
      return this.canvas.toDataURL('image/png');
    }

    getState() {
      return { ready: this.ready, length: LENGTH, type: this.type, view: this.view, zoom: this.zoom, theta: this.theta, phi: this.phi, pan: this.pan?.toArray(), visibility: { ...this.visibility }, width: this.width, height: this.height, meshCount: this.pickable?.length || 0 };
    }

    restoreState(snapshot) {
      if (!snapshot || typeof snapshot !== 'object' || this.disposed || !this.pan) return false;
      if (!['theta', 'phi', 'zoom'].every(key => typeof snapshot[key] === 'number' && Number.isFinite(snapshot[key]))) return false;
      if (!Array.isArray(snapshot.pan) || snapshot.pan.length !== 3 || !snapshot.pan.every(n => typeof n === 'number' && Number.isFinite(n))) return false;
      this.theta = snapshot.theta;
      this.phi = clamp(snapshot.phi, -1.48, 1.56);
      this.zoom = clamp(snapshot.zoom, .3, 6);
      this.pan.set(...snapshot.pan);
      this.view = ['perspective', 'front', 'side', 'top', 'manual'].includes(snapshot.view) ? snapshot.view : 'manual';
      this.setVisibility(snapshot.visibility && typeof snapshot.visibility === 'object' ? snapshot.visibility : {});
      this.scheduleRender();
      return true;
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      cancelAnimationFrame(this.frame);
      this.resizeObserver?.disconnect();
      for (const remove of this.listeners) remove();
      this.clearModel();
      this.light?.shadow.map?.dispose();
      this.renderer?.dispose();
      this.canvas?.remove();
      this.tooltip?.remove();
      this.errorElement?.remove();
      this.host.dataset.ready = 'false';
    }
  }
  WallScene.LENGTH = LENGTH;
  WallScene.soilSections = soilSections;
  window.WallScene = WallScene;
})();
