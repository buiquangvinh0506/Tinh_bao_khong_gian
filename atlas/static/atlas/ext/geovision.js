/** GEOINT OS GeoVision 1/2/3 - local avatar, movement, camera, horizon bridge. */
(function () {
  'use strict';
  const R = Math.PI / 180;
  const state = {
    ext: null, model: null, blobUrl: null, lat: 21.0285, lon: 105.8542,
    ground: 0, heading: 0, mode: 'third', active: false,
    keys: new Set(), last: 0, raf: 0, terrainBusy: false, lastTerrain: 0,
    moving: false, animationRunning: false, height: 1.6, scale: 1,
    observer: null, ray: null, analysis: false, sampleTimer: 0, ready: false
  };
  const $ = id => document.getElementById(id);
  const status = text => { if ($('gvStatus')) $('gvStatus').textContent = text; };
  const num = (id, fallback) => Number.isFinite(Number($(id)?.value)) ? Number($(id).value) : fallback;
  function getViewer() { return state.ext?.view; }
  function enuPoint(east, north, up) {
    const origin = Cesium.Cartesian3.fromDegrees(state.lon, state.lat, state.ground);
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
    return Cesium.Matrix4.multiplyByPoint(transform, new Cesium.Cartesian3(east, north, up), new Cesium.Cartesian3());
  }
  function syncModel() {
    if (!state.model) return;
    const origin = Cesium.Cartesian3.fromDegrees(state.lon, state.lat, state.ground);
    state.model.modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
      origin, new Cesium.HeadingPitchRoll(state.heading * R, 0, 0));
    state.model.scale = state.scale;
    state.model.show = state.mode !== 'first';
  }
  function cameraUpdate() {
    const viewer = getViewer();
    if (!viewer || !state.active) return;
    const heading = state.heading * R;
    const pitch = num('gvPitch', -14) * R;
    const eye = num('gvEye', 1.6);
    if (state.mode === 'first') {
      viewer.camera.setView({
        destination: enuPoint(0, 0, eye),
        orientation: { heading, pitch, roll: 0 }
      });
    } else {
      const distance = num('gvDistance', 6);
      const behindE = -Math.sin(heading) * distance;
      const behindN = -Math.cos(heading) * distance;
      viewer.camera.setView({
        destination: enuPoint(behindE, behindN, eye + distance * 0.35),
        orientation: { heading, pitch, roll: 0 }
      });
    }
  }
  function animationUpdate(moving) {
    if (!state.model || moving === state.animationRunning) return;
    try {
      if (moving) {
        state.model.activeAnimations.addAll({ loop: Cesium.ModelAnimationLoop.REPEAT });
      } else {
        state.model.activeAnimations.removeAll();
      }
      state.animationRunning = moving;
    } catch (e) { console.warn('GeoVision animation:', e); }
  }
  async function groundUpdate(force = false) {
    if (state.terrainBusy || !state.ready) return;
    if (!force && performance.now() - state.lastTerrain < 900) return;
    state.lastTerrain = performance.now();
    const provider = state.ext?.app?.getTerrain?.();
    if (!provider) return;
    state.terrainBusy = true;
    const lat = state.lat, lon = state.lon;
    try {
      const sample = await Cesium.sampleTerrainMostDetailed(provider, [Cesium.Cartographic.fromDegrees(lon, lat)]);
      if (Number.isFinite(sample[0].height) && Math.abs(state.lat - lat) < .0003 && Math.abs(state.lon - lon) < .0003) {
        state.ground = sample[0].height;
        syncModel();
      }
    } catch (e) { console.warn('GeoVision terrain sample:', e); }
    finally { state.terrainBusy = false; }
  }
  function updateReadout() {
    const out = $('gvReadout');
    if (out) out.textContent = `${state.lat.toFixed(6)}°, ${state.lon.toFixed(6)}° | ${state.ground.toFixed(1)} m | ${Math.round((state.heading + 360) % 360)}°`;
    if ($('gvLat')) $('gvLat').value = state.lat.toFixed(6);
    if ($('gvLon')) $('gvLon').value = state.lon.toFixed(6);
  }
  function move(dt) {
    if (!state.active) return;
    const keys = state.keys;
    const turn = (keys.has('a') ? -1 : 0) + (keys.has('d') ? 1 : 0);
    if (turn) state.heading = (state.heading + turn * 90 * dt + 360) % 360;
    const direction = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
    const moving = direction !== 0;
    animationUpdate(moving);
    if (moving) {
      const speed = num('gvSpeed', 1.5) * (keys.has('shift') ? 2 : 1);
      const step = Math.min(dt, 0.05) * speed * direction;
      // Geodesic movement on WGS84; ENU heading measured clockwise from north.
      const surface = Cesium.Cartographic.fromDegrees(state.lon, state.lat);
      const east = Math.sin(state.heading * R) * step;
      const north = Math.cos(state.heading * R) * step;
      const latRad = surface.latitude + north / 6378137;
      const cosLat = Math.max(0.01, Math.abs(Math.cos(surface.latitude)));
      const lonRad = surface.longitude + east / (6378137 * cosLat);
      state.lat = Math.max(-89.9, Math.min(89.9, latRad / R));
      state.lon = ((lonRad / R + 540) % 360) - 180;
      groundUpdate();
    }
    state.moving = moving;
    syncModel();
    cameraUpdate();
    updateAnalysisRay();
    updateReadout();
  }
  function frame(now) {
    if (!state.active) { state.raf = 0; return; }
    const dt = state.last ? Math.min((now - state.last) / 1000, 0.05) : 0;
    state.last = now;
    move(dt);
    getViewer()?.scene.requestRender();
    state.raf = requestAnimationFrame(frame);
  }
  function start() {
    if (!state.ready) { status('Hãy tải GLB hoặc chọn mô hình đã lưu trước.'); return; }
    if (getViewer().scene.mode !== Cesium.SceneMode.SCENE3D) {
      status('Hãy chuyển địa cầu sang chế độ 3D.'); return;
    }
    state.active = true; state.last = 0;
    getViewer().scene.screenSpaceCameraController.enableInputs = false;
    if (!state.raf) state.raf = requestAnimationFrame(frame);
    status('Đang điều khiển. W/S đi · A/D xoay · Shift tăng tốc · V đổi camera · Esc thoát.');
  }
  function stop() {
    state.active = false; state.keys.clear(); state.last = 0;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    animationUpdate(false);
    const v = getViewer();
    if (v) v.scene.screenSpaceCameraController.enableInputs = true;
    status('Đã dừng điều khiển; camera trở lại chế độ tự do.');
  }
  async function loadUrl(url, label, revoke = false) {
    stop();
    status(`Đang nạp ${label}...`);
    const v = getViewer();
    try {
      const model = await Cesium.Model.fromGltfAsync({
        url, modelMatrix: Cesium.Transforms.headingPitchRollToFixedFrame(
          Cesium.Cartesian3.fromDegrees(state.lon, state.lat, state.ground),
          new Cesium.HeadingPitchRoll(0, 0, 0)),
        scale: state.scale, minimumPixelSize: 0
      });
      if (state.model) v.scene.primitives.remove(state.model);
      state.model = v.scene.primitives.add(model);
      state.ready = true;
      state.animationRunning = false;
      if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
      state.blobUrl = revoke ? url : null;
      syncModel();
      await groundUpdate(true);
      updateReadout();
      v.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(state.lon, state.lat, state.ground + 120), duration: 1.8 });
      status(`Đã nạp ${label}. Chọn Bắt đầu điều khiển.`);
    } catch (e) {
      if (revoke) URL.revokeObjectURL(url);
      status(`Lỗi GLB: ${e.message || String(e)}`);
      console.error('GeoVision GLB:', e);
    }
  }
  function updateAnalysisRay() {
    const v = getViewer();
    if (!v || !state.analysis) return;
    const heading = state.heading * R;
    const eye = num('gvEye', 1.6);
    const startPoint = enuPoint(0, 0, eye);
    const endPoint = enuPoint(Math.sin(heading) * 200, Math.cos(heading) * 200, eye);
    if (!state.ray) {
      state.ray = v.entities.add({
        name: 'GeoVision: hướng quan sát minh họa',
        polyline: { positions: [startPoint, endPoint], width: 3, material: Cesium.Color.YELLOW }
      });
    } else {
      state.ray.polyline.positions = new Cesium.ConstantProperty([startPoint, endPoint]);
    }
  }
  function toggleAnalysis() {
    state.analysis = !state.analysis;
    if (!state.analysis && state.ray) { getViewer()?.entities.remove(state.ray); state.ray = null; }
    if (state.analysis) updateAnalysisRay();
    $('gvAnalysis').textContent = state.analysis ? '✓ Hiện hướng quan sát' : '◇ Hiện hướng quan sát';
    status(state.analysis ? 'Đường vàng chỉ phương vị camera, KHÔNG phải kết quả che khuất. Chọn đồng bộ Horizon để tính DEM.' : 'Đã ẩn đường phương vị.');
  }
  function syncHorizon() {
    if ($('hLat')) $('hLat').value = state.lat.toFixed(6);
    if ($('hLon')) $('hLon').value = state.lon.toFixed(6);
    if ($('hEye')) $('hEye').value = num('gvEye', 1.6).toFixed(2);
    status('Đã chuyển tọa độ và chiều cao mắt sang Horizon Radar. Chạy quét DEM ở tab Góc ngưỡng.');
  }
  function modeSwitch() {
    state.mode = state.mode === 'first' ? 'third' : 'first';
    if ($('gvMode')) $('gvMode').textContent = state.mode === 'first' ? '👁 Góc nhìn mắt' : '🎥 Camera sau lưng';
    syncModel(); cameraUpdate();
  }
  function keydown(e) {
    if (!state.active) return;
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable) return;
    const key = e.key.toLowerCase();
    if (key === 'escape') { stop(); return; }
    if (key === 'v' && !e.repeat) { modeSwitch(); return; }
    if (['w', 'a', 's', 'd', 'shift', 'arrowup', 'arrowdown'].includes(key)) { e.preventDefault(); state.keys.add(key); }
  }
  function keyup(e) { state.keys.delete(e.key.toLowerCase()); }
  function init(ext) {
    state.ext = ext;
    $('gvFile').addEventListener('change', e => {
      const file = e.target.files?.[0]; if (!file) return;
      if (!file.name.toLowerCase().endsWith('.glb')) { status('Chỉ hỗ trợ GLB.'); return; }
      if (file.size > 200 * 1024 * 1024) { status('GLB vượt 200 MB; hãy tối ưu mô hình trước.'); return; }
      loadUrl(URL.createObjectURL(file), file.name, true);
    });
    $('gvSaved').addEventListener('change', e => {
      const id = Number(e.target.value);
      const item = ext.modules.models?.models.find(x => x.id === id);
      if (!item) return;
      state.lat = Number(item.latitude); state.lon = Number(item.longitude);
      state.ground = Number(item.height); state.scale = Number(item.scale);
      $('gvScale').value = state.scale;
      loadUrl(item.url, item.name);
    });
    $('gvRefresh').addEventListener('click', () => {
      const select = $('gvSaved'); select.replaceChildren(new Option('— Chọn mô hình đã lưu —', ''));
      for (const item of ext.modules.models?.models || []) select.add(new Option(item.name, String(item.id)));
    });
    $('gvStart').addEventListener('click', start);
    $('gvStop').addEventListener('click', stop);
    $('gvMode').addEventListener('click', modeSwitch);
    $('gvSetPosition').addEventListener('click', async () => {
      const lat = num('gvLat', NaN), lon = num('gvLon', NaN);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 89.9 || Math.abs(lon) > 180) { status('Tọa độ không hợp lệ.'); return; }
      state.lat = lat; state.lon = lon; state.ground = 0;
      await groundUpdate(true); syncModel(); updateReadout(); cameraUpdate();
    });
    $('gvScale').addEventListener('change', () => { state.scale = Math.max(0.001, Math.min(100, num('gvScale', 1))); syncModel(); });
    $('gvSyncHorizon').addEventListener('click', syncHorizon);
    $('gvAnalysis').addEventListener('click', toggleAnalysis);
    document.addEventListener('keydown', keydown);
    document.addEventListener('keyup', event => {
      if (typeof event?.key !== 'string') {
        return;
      }

      const key = event.key.toLowerCase();

      // Giữ nguyên toàn bộ phần xử lý phím bên dưới.
    });
    window.addEventListener('blur', () => state.keys.clear());
    window.GeoVision = { start, stop, state, syncHorizon, toggleAnalysis };
    updateReadout();
  }
  window.GeoExt.register('geovision', { init });
})();
