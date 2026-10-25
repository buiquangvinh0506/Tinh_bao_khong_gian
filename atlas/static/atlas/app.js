/**
 * GEOINT VINH 3D ATLAS v0.6
 * CesiumJS 1.133 | Django | PostgreSQL
 * Local research tooling: place CRUD, audit log, GeoJSON, measurement.
 */
'use strict';

const $ = id => document.getElementById(id);
const CATEGORIES = {
  research: { label: 'Nghiên cứu', color: '#36cff5' },
  civic: { label: 'Công cộng', color: '#ffc06b' },
  heritage: { label: 'Di sản', color: '#e7a3fc' },
  transport: { label: 'Giao thông', color: '#93dd86' },
  environment: { label: 'Môi trường', color: '#65daaa' },
  other: { label: 'Khác', color: '#c4d6e7' }
};

let viewer = null;
let imageryLayer = null;
let savedTerrainProvider = null;
let allPlaces = [];
let placeEntities = [];
let editId = null;
let measureMode = null;
let measureCoordinates = [];
let measureEntities = [];
let measureMoving = null;
let terrainEnabled = true;
let placesEnabled = true;
let googleTileset = null;
let google3DActive = false;
let google3DLoading = false;
let globeWasVisible = true;
let sceneModeBeforeGoogle = null;
const csrf = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';

function notify(text, level='info') {
  const el = $('message');
  if (el) {
    el.textContent = String(text);
    el.dataset.level = level;
  }
}
function stringifyError(err) {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err) ?? String(err); }
  catch { return String(err); }
}
function finite(number, min, max) {
  const n = Number(number);
  return Number.isFinite(n) && n >= min && n <= max;
}
function numberText(n, digits=5) { return Number(n).toFixed(digits); }
function safeDescription(s) {
  const el = document.createElement('div');
  el.textContent = s || 'Không có mô tả';
  return el.innerHTML;
}
function readConfigToken() {
  const token = window.GEOINT_CONFIG?.cesiumToken?.trim() || '';
  if (!token || /PASTE_|TOKEN_HERE|TOKEN_CUA_ONG|DAN_TOKEN/i.test(token)) return '';
  return token;
}

async function api(url, options={}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`Máy chủ trả về dữ liệu không phải JSON (${response.status})`); }
  if (!response.ok) throw new Error(json.error || json.detail || `HTTP ${response.status}`);
  return json;
}

function drawPlaces() {
  if (!viewer) return;
  for (const e of placeEntities) viewer.entities.remove(e);
  placeEntities = [];
  for (const place of allPlaces) {
    const lng = Number(place.longitude), lat = Number(place.latitude);
    if (!finite(lng, -180, 180) || !finite(lat, -90, 90)) continue;
    const color = Cesium.Color.fromCssColorString((CATEGORIES[place.category] || CATEGORIES.other).color);
    const entity = viewer.entities.add({
      id: `place_${place.id}`,
      name: place.name,
      position: Cesium.Cartesian3.fromDegrees(lng, lat),
      point: {
        pixelSize: 11, color, outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: place.name, font: '12px Segoe UI, sans-serif',
        pixelOffset: new Cesium.Cartesian2(0, -22),
        fillColor: Cesium.Color.WHITE, showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#07192b'),
        backgroundPadding: new Cesium.Cartesian2(5, 3),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 850000)
      },
      description: safeDescription(place.description)
    });
    entity.geointPlaceId = place.id;
    placeEntities.push(entity);
  }
  applyPlaceFilter();
}

function inView(place) {
  if (!$('filterViewport').checked || !viewer) return true;
  const r = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
  if (!r) return true;
  return Cesium.Rectangle.contains(r, Cesium.Cartographic.fromDegrees(
    Number(place.longitude), Number(place.latitude)));
}
function applyPlaceFilter() {
  const query = $('searchPlaces').value.trim().toLocaleLowerCase('vi');
  const category = $('filterCategory').value;
  const filtered = allPlaces.filter(p => {
    if (category !== 'all' && p.category !== category) return false;
    if (!inView(p)) return false;
    if (!query) return true;
    return [p.name, p.description, p.category, p.source_url, p.latitude, p.longitude]
      .some(x => String(x ?? '').toLocaleLowerCase('vi').includes(query));
  });
  const ids = new Set(filtered.map(p => p.id));
  for (const entity of placeEntities) {
    entity.show = placesEnabled && ids.has(entity.geointPlaceId);
  }
  const container = $('placesList');
  container.replaceChildren();
  for (const p of filtered) container.appendChild(renderPlace(p));
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = allPlaces.length ? 'Không có địa điểm phù hợp bộ lọc.' : 'Chưa có địa điểm nào. Nhấp lên địa cầu để thêm điểm đầu tiên.';
    container.appendChild(empty);
  }
  $('count').textContent = filtered.length;
  $('statPlaces').textContent = allPlaces.length;
  $('statVisible').textContent = placesEnabled ? filtered.length : 0;
  $('statCategories').textContent = new Set(allPlaces.map(p=>p.category)).size;
}

function renderPlace(p) {
  const node = document.createElement('article'); node.className = 'place';
  const heading = document.createElement('div'); heading.className = 'place-title';
  const name = document.createElement('div'); name.className = 'place-name'; name.textContent = p.name;
  const type = document.createElement('span'); type.className = 'place-type';
  type.textContent = (CATEGORIES[p.category] || CATEGORIES.other).label;
  heading.append(name, type);
  const coords = document.createElement('div'); coords.className = 'place-coords';
  coords.textContent = `Vĩ ${numberText(p.latitude)}° · Kinh ${numberText(p.longitude)}°`;
  const desc = document.createElement('div'); desc.className = 'place-desc';
  desc.textContent = p.description || 'Chưa có mô tả.';
  const buttons = document.createElement('div'); buttons.className = 'place-actions';
  const makeButton = (label, handler, extraClass='') => {
    const b = document.createElement('button'); b.type='button'; b.textContent=label;
    if (extraClass) b.className = extraClass;
    b.addEventListener('click',handler); buttons.appendChild(b);
  };
  makeButton('◎ Bay tới', () => viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(+p.longitude, +p.latitude, 75000), duration: 1.8
  }));
  makeButton('✎ Sửa', () => fillForm(p));
  if (p.source_url && /^https?:\/\//i.test(p.source_url)) {
    makeButton('↗ Nguồn', () => window.open(p.source_url,'_blank','noopener,noreferrer'));
  }
  makeButton('× Xóa', () => deletePlace(p), 'delete');
  node.append(heading, coords, desc, buttons);
  return node;
}

async function fetchPlaces() {
  const data = await api('/api/places/');
  if (!Array.isArray(data.places)) throw new Error('Danh sách places không hợp lệ');
  allPlaces = data.places;
  drawPlaces();
}
function fillForm(place) {
  editId = place.id;
  $('formTitle').textContent = `✎ Sửa địa điểm #${place.id}`;
  $('savePlace').textContent = '✓ Cập nhật địa điểm';
  $('cancelEdit').classList.remove('hidden');
  $('name').value = place.name;
  $('description').value = place.description || '';
  $('latitude').value = place.latitude;
  $('longitude').value = place.longitude;
  $('category').value = place.category || 'research';
  $('sourceUrl').value = place.source_url || '';
  $('name').focus();
  notify('Đang sửa địa điểm. Nhấn Cập nhật để lưu thay đổi.');
}
function clearForm() {
  editId = null;
  $('placeForm').reset();
  $('formTitle').textContent = '+ Địa điểm mới';
  $('savePlace').textContent = '＋ Lưu vào PostgreSQL';
  $('cancelEdit').classList.add('hidden');
}
async function savePlace(event) {
  event.preventDefault();
  const latitudeRaw = $('latitude').value.trim();
  const longitudeRaw = $('longitude').value.trim();
  if (!latitudeRaw || !longitudeRaw || !finite(latitudeRaw,-90,90) || !finite(longitudeRaw,-180,180)) {
    notify('Vĩ độ / kinh độ không hợp lệ.', 'error'); return;
  }
  const payload = {
    name: $('name').value.trim(), description: $('description').value.trim(),
    latitude: Number(latitudeRaw), longitude: Number(longitudeRaw),
    category: $('category').value, source_url: $('sourceUrl').value.trim()
  };
  if (!payload.name) { notify('Vui lòng nhập tên.', 'error'); return; }
  const savingId = editId;
  const btn = $('savePlace'); btn.disabled = true;
  try {
    if (savingId !== null) {
      await api(`/api/places/${savingId}/`, { method:'PATCH', body:JSON.stringify(payload) });
      notify('Đã cập nhật địa điểm trong PostgreSQL.');
    } else {
      await api('/api/places/', { method:'POST', body:JSON.stringify(payload) });
      notify('Đã lưu địa điểm mới trong PostgreSQL.');
    }
    clearForm(); await fetchPlaces();
  } catch (error) {
    notify(`Lỗi lưu dữ liệu: ${stringifyError(error)}`, 'error');
  } finally { btn.disabled = false; }
}
async function deletePlace(p) {
  if (!window.confirm(`Xóa địa điểm "${p.name}" khỏi cơ sở dữ liệu?`)) return;
  try {
    await api(`/api/places/${p.id}/`, { method:'DELETE' });
    if (editId === p.id) clearForm();
    await fetchPlaces(); notify('Đã xóa địa điểm; thao tác được ghi vào nhật ký.');
  } catch (error) { notify(`Lỗi xóa: ${stringifyError(error)}`, 'error'); }
}

async function loadActivity() {
  try {
    const data = await api('/api/activity/');
    const panel = $('journalList'); panel.replaceChildren();
    if (!data.events.length) {
      const empty = document.createElement('div'); empty.className='empty-state';
      empty.textContent='Chưa có hoạt động nào.'; panel.appendChild(empty); return;
    }
    const names = { created:'Tạo địa điểm', updated:'Cập nhật', deleted:'Xóa', imported:'Nhập GeoJSON' };
    for (const item of data.events) {
      const entry = document.createElement('div'); entry.className='journal-entry';
      const h = document.createElement('div'); h.className='journal-title';
      h.textContent=`${names[item.action] || item.action} · ${item.place_name}`;
      const sub = document.createElement('div'); sub.className='journal-sub';
      const time = new Date(item.timestamp);
      sub.textContent=`${Number.isNaN(time.getTime())?'':time.toLocaleString('vi-VN')} · ${item.detail || 'Lưu trong PostgreSQL'}`;
      entry.append(h,sub); panel.appendChild(entry);
    }
  } catch (error) { notify(`Lỗi nhật ký: ${stringifyError(error)}`, 'error'); }
}
function openTab(name) {
  for (const t of ['Places','Journal','Data','GeoLab','Horizon','Models','Layers']) {
    const selected = t === name;
    $(`panel${t}`).classList.toggle('active', selected);
    $(`tab${t}`).classList.toggle('active', selected);
    $(`tab${t}`).setAttribute('aria-selected', String(selected));
  }
  if (name === 'Journal') loadActivity();
  window.GeoExt?.sync();
}

async function exportGeojson() {
  try {
    // Use the server as the source of truth, not the currently filtered list.
    const collection = await api('/api/places/geojson/');
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type:'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='GEOINT_Vinh_places.geojson';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    notify('Đã xuất GeoJSON từ cơ sở dữ liệu.');
  } catch (error) { notify(`Lỗi xuất: ${stringifyError(error)}`, 'error'); }
}
async function importGeojson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2_500_000) throw new Error('Tệp lớn hơn 2,5 MB');
    const data = JSON.parse(await file.text());
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error('Phải là GeoJSON FeatureCollection');
    }
    if (data.features.length > 300) throw new Error('Tối đa 300 đối tượng/lần');
    const result = await api('/api/places/import/', { method:'POST', body: JSON.stringify(data) });
    $('importReport').textContent=`Đã nhập ${result.imported} điểm; bỏ qua ${result.ignored} đường/vùng.`;
    await fetchPlaces(); notify('Nhập dữ liệu thành công. Đã ghi nhật ký.');
  } catch (error) {
    $('importReport').textContent=stringifyError(error);
    notify(`Lỗi nhập: ${stringifyError(error)}`, 'error');
  } finally { event.target.value=''; }
}

function pickLocation(position) {
  // Photorealistic 3D Tiles are primitives, not Cesium World Terrain.
  // pickPosition uses the rendered depth buffer and can pick building roofs.
  if (google3DActive && viewer.scene.pickPositionSupported) {
    try {
      const picked = viewer.scene.pick(position);
      if (Cesium.defined(picked)) {
        const surface = viewer.scene.pickPosition(position);
        if (Cesium.defined(surface)) return Cesium.Cartographic.fromCartesian(surface);
      }
    } catch (error) {
      console.warn('Google 3D depth picking unavailable:', error);
    }
  }
  const ray = viewer.camera.getPickRay(position);
  let result = (!google3DActive && ray) ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;
  if (!result) result = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
  return result ? Cesium.Cartographic.fromCartesian(result) : null;
}
function setCoordinateInputs(c) {
  $('latitude').value = Cesium.Math.toDegrees(c.latitude).toFixed(6);
  $('longitude').value = Cesium.Math.toDegrees(c.longitude).toFixed(6);
}
function formatLength(metres) {
  return metres >= 1000 ? `${(metres/1000).toLocaleString('vi-VN',{maximumFractionDigits:2})} km` :
    `${metres.toLocaleString('vi-VN',{maximumFractionDigits:1})} m`;
}
function getSurfaceLength(points) {
  let result = 0;
  for (let i=1;i<points.length;i++) {
    const start = points[i-1], end = points[i];
    // EllipsoidGeodesic: horizontal surface distance (does not include terrain slopes).
    const geodesic = new Cesium.EllipsoidGeodesic(start,end,viewer.scene.globe.ellipsoid);
    result += geodesic.surfaceDistance;
  }
  return result;
}
function approxArea(points) {
  // Chamberlain-Duquette style spherical area; approximate and assumes simple polygon.
  if (points.length < 3) return 0;
  const earthRadius=6371008.8;
  let sum=0;
  for (let i=0;i<points.length;i++) {
    const a=points[i], b=points[(i+1)%points.length];
    let delta=b.longitude-a.longitude;
    if (delta>Math.PI) delta-=2*Math.PI;
    if (delta<-Math.PI) delta+=2*Math.PI;
    sum += delta*(2+Math.sin(a.latitude)+Math.sin(b.latitude));
  }
  const area=Math.abs(sum)*earthRadius*earthRadius/2;
  const sphere=4*Math.PI*earthRadius*earthRadius;
  return Math.min(area,sphere-area);
}
function clearMeasure() {
  for (const e of measureEntities) viewer.entities.remove(e);
  measureEntities=[]; measureCoordinates=[];
  if (measureMoving) { viewer.entities.remove(measureMoving); measureMoving=null; }
  measureMode=null;
  $('measureDistance').classList.remove('selected');
  $('measureArea').classList.remove('selected');
  $('measureValue').textContent='Chưa đo';
  $('measureHint').textContent='Nhấp trên bản đồ để đo; nhấp đôi để kết thúc.';
}
function setMeasureMode(next) {
  if (window.GeoExt) { window.GeoExt.activeTool=null; document.querySelectorAll('[data-geotool]').forEach(b=>b.classList.remove('selected')); }
  if (measureMode === next) { clearMeasure(); return; }
  clearMeasure(); measureMode=next;
  $(next==='distance'?'measureDistance':'measureArea').classList.add('selected');
  $('measureHint').textContent=next==='distance' ?
    'Nhấp ≥2 điểm để đo chiều dài trên ellipsoid; nhấp đôi để dừng.' :
    'Nhấp ≥3 đỉnh để đo diện tích xấp xỉ; nhấp đôi để dừng.';
  $('measureValue').textContent='Đang chọn điểm...';
}
function drawMeasure() {
  for (const e of measureEntities) viewer.entities.remove(e);
  measureEntities=[];
  if (!measureCoordinates.length) return;
  const positions=measureCoordinates.map(c=>Cesium.Cartesian3.fromRadians(c.longitude,c.latitude,0));
  for (const pos of positions) measureEntities.push(viewer.entities.add({
    position:pos, point:{ pixelSize:9,color:Cesium.Color.YELLOW,outlineColor:Cesium.Color.BLACK,outlineWidth:2,heightReference:Cesium.HeightReference.CLAMP_TO_GROUND }
  }));
  if (positions.length>=2) measureEntities.push(viewer.entities.add({
    polyline:{ positions, width:3, material:Cesium.Color.YELLOW,clampToGround:true }
  }));
  if (measureMode==='area' && positions.length>=3) measureEntities.push(viewer.entities.add({
    polygon:{ hierarchy:positions, material:Cesium.Color.YELLOW.withAlpha(0.22), outline:false,
      heightReference:Cesium.HeightReference.CLAMP_TO_GROUND }
  }));
  if (measureMode==='distance') {
    $('measureValue').textContent = positions.length>=2 ? formatLength(getSurfaceLength(measureCoordinates)) : 'Chọn thêm điểm';
  } else {
    const area=approxArea(measureCoordinates);
    $('measureValue').textContent = positions.length>=3 ?
      `${(area>=1000000?area/1000000:area).toLocaleString('vi-VN',{maximumFractionDigits:3})} ${area>=1000000?'km²':'m²'} ≈` : 'Chọn ít nhất 3 điểm';
  }
}
function finishMeasure() {
  if (!measureMode) return;
  // Stop editing; preserve the last rendered measurement on the globe.
  measureMode=null;
  $('measureDistance').classList.remove('selected'); $('measureArea').classList.remove('selected');
  $('measureHint').textContent='Đã kết thúc phép đo. Nhấn Xóa để làm phép đo khác.';
}

function bindGlobeInteractions() {
  const handler=new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(event=>{
    const cartographic=pickLocation(event.position);
    if (window.GeoExt?.onMapClick(event.position,cartographic)) return;
    if (!cartographic) return;
    if (measureMode) {
      measureCoordinates.push(cartographic); drawMeasure(); return;
    }
    setCoordinateInputs(cartographic);
    notify('Đã lấy tọa độ. Nhập tên để lưu hoặc dùng chế độ đo đạc.');
  },Cesium.ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(()=>finishMeasure(),Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  let lastMouseTime=0;
  handler.setInputAction(event=>{
    if (Date.now()-lastMouseTime<140) return;
    lastMouseTime=Date.now();
    const c=pickLocation(event.endPosition);
    if (c) $('hoverCoords').textContent = `Kinh độ ${Cesium.Math.toDegrees(c.longitude).toFixed(4)}° · Vĩ độ ${Cesium.Math.toDegrees(c.latitude).toFixed(4)}°`;
  },Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  let lastUpdate=0;
  viewer.camera.changed.addEventListener(()=>{
    const now=Date.now(); if (now-lastUpdate<250) return;
    lastUpdate=now;
    const h=viewer.camera.positionCartographic.height;
    $('cameraHeight').textContent=`Độ cao camera ${formatLength(Math.max(0,h))}`;
    if ($('filterViewport').checked) applyPlaceFilter();
  });
}

// Switch between ion satellite/terrain and Google's photorealistic 3D Tiles.
// Tiles are loaded only after an explicit click, to avoid unnecessary usage.
function updateGoogle3DUi() {
  const button = $('toggleGoogle3D');
  const status = $('google3DStatus');
  if (!button || !status) return;
  button.disabled = google3DLoading;
  button.textContent = google3DLoading
    ? 'Đang tải Google 3D…'
    : google3DActive ? '↩ Về vệ tinh + địa hình' : '▣ Bật Google 3D';
  button.classList.toggle('selected', google3DActive);
  status.textContent = google3DLoading ? 'Đang yêu cầu 3D Tiles từ Cesium ion…'
    : google3DActive ? 'Google 3D đang bật · nhấp mái nhà để lấy tọa độ'
    : 'Google 3D đang tắt · không tiêu tốn lượt tải 3D Tiles';
  // Terrain-only controls have no effect when the ellipsoid globe is hidden.
  for (const id of ['terrainSwitch','terrainExaggeration','opacityRange','lightingSwitch','mode2d']) {
    const element = $(id);
    if (element) element.disabled = google3DActive || google3DLoading;
  }
}

async function toggleGoogle3D() {
  if (!viewer || google3DLoading) return;
  if (google3DActive) {
    google3DActive = false;
    if (googleTileset) googleTileset.show = false;
    viewer.scene.globe.show = globeWasVisible;
    $('mapStatus').textContent = savedTerrainProvider ? 'Ảnh nền + địa hình 3D' : 'Địa cầu cơ bản';
    updateGoogle3DUi();
    window.dispatchEvent(new Event('geoint:scene-changed'));
    notify('Đã quay về Cesium World Terrain.');
    viewer.scene.requestRender();
    return;
  }
  if (viewer.scene.mode !== Cesium.SceneMode.SCENE3D) {
    viewer.scene.morphTo3D(0);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  google3DLoading = true;
  updateGoogle3DUi();
  notify('Đang khởi tạo Google Photorealistic 3D Tiles…');
  try {
    if (!googleTileset) {
      // CesiumJS 1.133. Requires ion token authorized for Google 3D Tiles.
      const tileset = await Cesium.createGooglePhotorealistic3DTileset({
        onlyUsingWithGoogleGeocoder: true
      });
      googleTileset = viewer.scene.primitives.add(tileset);
      if (googleTileset.tileFailed) {
        googleTileset.tileFailed.addEventListener(error => console.warn('Google 3D tile failed:', error));
      }
    }
    globeWasVisible = viewer.scene.globe.show;
    viewer.scene.globe.show = false; // Avoid double rendering Google terrain + Cesium globe.
    googleTileset.show = true;
    google3DActive = true;
    $('mapStatus').textContent = 'Google Photorealistic 3D';
    notify('Đã bật Google 3D. Hãy phóng gần thành phố có dữ liệu.');
    viewer.scene.requestRender();
  } catch (error) {
    console.error('Google Photorealistic 3D failed:', error);
    if (googleTileset) googleTileset.show = false;
    viewer.scene.globe.show = true;
    google3DActive = false;
    notify(`Không bật được Google 3D: ${stringifyError(error)}. Đã giữ địa cầu vệ tinh.`, 'error');
  } finally {
    google3DLoading = false;
    updateGoogle3DUi();
    window.dispatchEvent(new Event('geoint:scene-changed'));
  }
}

function bindUi() {
  $('placeForm').addEventListener('submit',savePlace);
  $('clearForm').addEventListener('click',clearForm);
  $('cancelEdit').addEventListener('click',clearForm);
  $('refreshPlaces').addEventListener('click',()=>fetchPlaces().then(()=>notify('Đã đồng bộ địa điểm.')).catch(e=>notify(stringifyError(e),'error')));
  $('searchPlaces').addEventListener('input',applyPlaceFilter);
  $('filterCategory').addEventListener('change',applyPlaceFilter);
  $('filterViewport').addEventListener('change',applyPlaceFilter);
  $('tabPlaces').addEventListener('click',()=>openTab('Places'));
  $('tabJournal').addEventListener('click',()=>openTab('Journal'));
  $('tabData').addEventListener('click',()=>openTab('Data'));
  for(const tab of ['GeoLab','Horizon','Models','Layers']) {
    $(`tab${tab}`).addEventListener('click',()=>openTab(tab));
  }
  $('refreshJournal').addEventListener('click',loadActivity);
  $('exportGeojson').addEventListener('click',exportGeojson);
  $('importFile').addEventListener('change',importGeojson);
  $('viewWorld').addEventListener('click',()=>viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(85,19,20000000),duration:1.6}));
  $('viewVietnam').addEventListener('click',()=>viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(106.1,16.2,3400000),duration:1.6}));
  $('viewSapa').addEventListener('click',()=>viewer.camera.flyTo({
    destination:Cesium.Cartesian3.fromDegrees(103.8438,22.3364,15500),
    orientation:{heading:Cesium.Math.toRadians(30),pitch:Cesium.Math.toRadians(-48),roll:0},duration:1.8
  }));
  $('mode2d').addEventListener('click',()=>{ if (!google3DActive) viewer.scene.morphTo2D(1.4); });
  $('mode3d').addEventListener('click',()=>viewer.scene.morphTo3D(1.4));
  $('toggleGoogle3D').addEventListener('click', toggleGoogle3D);
  $('lightingSwitch').addEventListener('change',e=>{viewer.scene.globe.enableLighting=e.target.checked;});
  $('placesSwitch').addEventListener('change',e=>{placesEnabled=e.target.checked;applyPlaceFilter();});
  $('terrainSwitch').addEventListener('change',e=>{
    terrainEnabled=e.target.checked;
    viewer.terrainProvider=terrainEnabled && savedTerrainProvider ? savedTerrainProvider : new Cesium.EllipsoidTerrainProvider();
    $('mapStatus').textContent=terrainEnabled?'Địa hình bật':'Địa cầu phẳng';
  });
  $('terrainExaggeration').addEventListener('input',e=>{
    const value=Number(e.target.value);
    viewer.scene.verticalExaggeration=value;
    $('terrainValue').textContent=`${value.toFixed(2)}×`;
  });
  $('opacityRange').addEventListener('input',e=>{
    const value=Number(e.target.value);
    if (imageryLayer) imageryLayer.alpha=value/100;
    $('opacityValue').textContent=`${value}%`;
  });
  $('measureDistance').addEventListener('click',()=>setMeasureMode('distance'));
  $('measureArea').addEventListener('click',()=>setMeasureMode('area'));
  $('clearMeasure').addEventListener('click',clearMeasure);
}

async function initializeIonLayers() {
  const [imageryResult,terrainResult]=await Promise.allSettled([
    Cesium.IonImageryProvider.fromAssetId(2),
    Cesium.createWorldTerrainAsync()
  ]);
  if (imageryResult.status==='fulfilled') {
    imageryLayer=viewer.imageryLayers.addImageryProvider(imageryResult.value);
    imageryResult.value.errorEvent.addEventListener(e=>console.warn('Imagery tile error',e));
    console.log('Ion imagery initialized');
  } else console.error('Ion imagery initialization failed',imageryResult.reason);
  if (terrainResult.status==='fulfilled') {
    savedTerrainProvider=terrainResult.value;
    viewer.terrainProvider=savedTerrainProvider;
    console.log('Ion terrain initialized');
  } else {
    $('terrainSwitch').checked=false;
    console.error('Ion terrain initialization failed',terrainResult.reason);
  }
  $('mapStatus').textContent = imageryLayer ? (savedTerrainProvider?'Ảnh nền + địa hình 3D':'Ảnh nền, thiếu địa hình') : 'Thiếu ảnh nền';
  if (!imageryLayer || !savedTerrainProvider) notify('Một số tài nguyên Cesium ion không tải được. Xem Console.', 'error');
}

async function start() {
  if (!window.Cesium) { notify('Không tải được CesiumJS; kiểm tra kết nối CDN.','error'); return; }
  const token=readConfigToken();
  if (token) Cesium.Ion.defaultAccessToken=token;
  else notify('Thiếu token trong config.local.js. Địa cầu vẫn có thể khởi động.','error');
  viewer=new Cesium.Viewer('globe',{
    baseLayer:false,terrainProvider:new Cesium.EllipsoidTerrainProvider(),
    animation:false,timeline:false,geocoder:Cesium.IonGeocodeProviderType.GOOGLE,baseLayerPicker:false,
    homeButton:false,sceneModePicker:false,navigationHelpButton:true,
    fullscreenButton:true,infoBox:true,selectionIndicator:true
  });
  window.geointViewer=viewer;
  viewer.scene.globe.baseColor=Cesium.Color.fromCssColorString('#18366d');
  viewer.camera.setView({destination:Cesium.Cartesian3.fromDegrees(84,23,19000000)});
  bindUi(); bindGlobeInteractions(); updateGoogle3DUi();
  window.GeoExt?.init({
    viewer, csrf, notify, pickLocation, cancelMeasure:()=>clearMeasure(),
    getTerrain:()=>savedTerrainProvider, getImagery:()=>imageryLayer,
    isGoogleActive:()=>google3DActive, toggleGoogle3D
  });
  try { await fetchPlaces(); }
  catch(error) { notify(`Lỗi dữ liệu PostgreSQL: ${stringifyError(error)}`,'error'); }
  if (token) await initializeIonLayers();
  window.GeoExt?.sync();
  console.log(`GEOINT OS v0.6 ready — CesiumJS ${Cesium.VERSION}`);
  if (imageryLayer) notify('GEOINT OS v0.6 sẵn sàng. Chọn địa điểm hoặc dùng đo đạc.');
}
start().catch(error=>{
  console.error('GEOINT STARTUP ERROR:',error);
  notify(`Lỗi khởi động: ${stringifyError(error)}`,'error');
});
