/** Horizon Lab 360: exploratory DEM radial sweep, then one chosen azimuth. */
(function () {
  'use strict';
  const R = 6371008.8;
  const rad = Math.PI / 180;
  function destination(latDeg, lonDeg, azDeg, metres) {
    const lat = latDeg * rad, lon = lonDeg * rad, bearing = azDeg * rad, d = metres / R;
    const lat2 = Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(bearing));
    const lon2 = lon + Math.atan2(Math.sin(bearing)*Math.sin(d)*Math.cos(lat), Math.cos(d)-Math.sin(lat)*Math.sin(lat2));
    return {lat:lat2, lon:Math.atan2(Math.sin(lon2),Math.cos(lon2))};
  }
  function classify(heights, eyeHeight, step) {
    if (!Number.isFinite(heights[0])) throw new Error('DEM tại điểm quan sát không hợp lệ');
    const eye = heights[0] + eyeHeight;
    let maxAngle = -Infinity, uncertain = false;
    return heights.map((height, i) => {
      if (!i) return {distance:0,height,angle:null,horizon:null,state:'observer'};
      if (!Number.isFinite(height)) { uncertain=true; return {distance:i*step,height:null,angle:null,horizon:maxAngle,state:'missing'}; }
      const angle = Math.atan2(height-eye, i*step)/rad;
      const before = maxAngle;
      const visible = angle > before + 1e-8;
      maxAngle = Math.max(maxAngle,angle);
      return {distance:i*step,height,angle,horizon:before,state:uncertain?'uncertain':visible?'visible':'hidden'};
    });
  }
  const lab = {
    init(ext) {
      this.ext=ext; this.$=ext.$; this.records=[]; this.rays=[]; this.entities=[]; this.busy=false; this.cancelled=false; this.scanned=false; this.radarAngle=0; this.radarTimer=null; this.radarActive=false; this.sweepSpeed=35; this.lastFrame=0; this.sweepRaf=0; this.radarP=null; this.resultEntities=[]; this.radarLoops=0;
      const pick=this.$('hPickObserver'); pick.dataset.geotool='horizon:observer';
      pick.addEventListener('click',()=>{const enabled=ext.setTool('horizon:observer'); ext.app.notify(enabled?'Nhấp địa hình để chọn điểm quan sát':'Đã hủy chọn điểm');});
      this.$('hScan').addEventListener('click',()=>this.scan());
      this.$('hRun').addEventListener('click',()=>this.run());
      this.$('hClear').addEventListener('click',()=>this.clear());
      this.$('hCancel').addEventListener('click',()=>{this.cancelled=true;this.stopRadar();this.$('hSummary').textContent='Đã dừng quét. Kết quả đã tính vẫn được giữ.';});
      this.$('hExport').addEventListener('click',()=>this.export());
      for (const id of ['hLat','hLon','hDistance','hEye','hSamples','hDirections']) this.$(id).addEventListener('change',()=>this.invalidate());
      this.setReady(false);
    },
    onClick(_screen,c) {
      if(!c){this.ext.app.notify('Không xác định được tọa độ','error');return true;}
      this.$('hLat').value=Cesium.Math.toDegrees(c.latitude).toFixed(6);
      this.$('hLon').value=Cesium.Math.toDegrees(c.longitude).toFixed(6);
      this.ext.setTool('horizon:observer'); this.invalidate();
      this.ext.app.notify('Đã chọn điểm. Quét 360° trước khi chọn phương vị.'); return true;
    },
    setReady(ok) { this.scanned=ok; this.$('hAzimuth').disabled=!ok; this.$('hRun').disabled=!ok; },
    invalidate() { this.setReady(false); this.rays=[]; this.records=[]; this.removeDrawings(); this.$('hSummary').textContent='Thông số thay đổi: cần quét lại 360°.'; },
    removeDrawings(){this.stopRadar();for(const e of this.entities)this.ext.view.entities.remove(e);this.entities=[];this.resultEntities=[];},
    clear(){this.cancelled=true;this.setReady(false);this.rays=[];this.records=[];this.removeDrawings();this.$('hSummary').textContent='Chưa quét.';this.$('hChart').textContent='Mặt cắt xuất hiện sau khi chọn phương vị.';},
    params(){const x=this.ext;return {lat:x.number('hLat',-90,90),lon:x.number('hLon',-180,180),distance:x.number('hDistance',0.2,20)*1000,eye:x.number('hEye',0.5,50),count:Math.round(x.number('hSamples',20,120)),directions:Math.round(x.number('hDirections',12,72))};},
    terrain(){if(this.ext.app.isGoogleActive())throw new Error('Hãy tắt Google 3D để sử dụng DEM World Terrain.');const p=this.ext.app.getTerrain();if(!p)throw new Error('Chưa có Cesium World Terrain.');return p;},
    async sample(provider,positions){try{return await Cesium.sampleTerrainMostDetailed(provider,positions);}catch(e){console.warn('Dùng DEM level 12 dự phòng',e);return Cesium.sampleTerrain(provider,12,positions);}},
    async profile(p,provider,az){const step=p.distance/(p.count-1);const positions=Array.from({length:p.count},(_,i)=>{const d=destination(p.lat,p.lon,az,i*step);return new Cesium.Cartographic(d.lon,d.lat,0);});const sampled=await this.sample(provider,positions);return classify(sampled.map(x=>x.height),p.eye,step).map((r,i)=>({...r,latitude:positions[i].latitude/rad,longitude:positions[i].longitude/rad,azimuth:az}));},
    // Display animation is independent of DEM network requests.
    // Result cells are coloured ONLY after their DEM profile is available.
    radarGeometry(p,az){
      const trail=[];
      for(let k=0;k<=10;k++){
        const q=destination(p.lat,p.lon,az-14+k*14/10,p.distance);
        trail.push(q.lon/rad,q.lat/rad);
      }
      const end=destination(p.lat,p.lon,az,p.distance);
      return {end:[end.lon/rad,end.lat/rad],fan:Cesium.Cartesian3.fromDegreesArray([p.lon,p.lat,...trail,p.lon,p.lat])};
    },
    beginRadar(p){
      this.removeDrawings();this.radarP=p;this.radarAngle=0;this.radarLoops=0;this.radarActive=true;
      const v=this.ext.view;
      for(const f of [0.25,0.5,0.75,1]){
        const coords=[];
        for(let a=0;a<=360;a+=5){const q=destination(p.lat,p.lon,a,p.distance*f);coords.push(q.lon/rad,q.lat/rad);}
        this.entities.push(v.entities.add({polyline:{positions:Cesium.Cartesian3.fromDegreesArray(coords),width:1,material:Cesium.Color.fromCssColorString('#68e7b7').withAlpha(.42),clampToGround:true}}));
      }
      this.entities.push(v.entities.add({position:Cesium.Cartesian3.fromDegrees(p.lon,p.lat),point:{pixelSize:11,color:Cesium.Color.WHITE,heightReference:Cesium.HeightReference.CLAMP_TO_GROUND}}));
      this.entities.push(v.entities.add({polygon:{hierarchy:new Cesium.CallbackProperty(()=>new Cesium.PolygonHierarchy(this.radarGeometry(p,this.radarAngle).fan),false),material:Cesium.Color.fromCssColorString('#44ffab').withAlpha(.18),heightReference:Cesium.HeightReference.CLAMP_TO_GROUND}}));
      this.entities.push(v.entities.add({polyline:{positions:new Cesium.CallbackProperty(()=>{const q=this.radarGeometry(p,this.radarAngle).end;return Cesium.Cartesian3.fromDegreesArray([p.lon,p.lat,...q]);},false),width:3,material:Cesium.Color.fromCssColorString('#a2ffca'),clampToGround:true}}));
      v.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(p.lon,p.lat,Math.max(2200,p.distance*2.1)),duration:1.2});
      this.lastFrame=0;
      const tick=(now)=>{
        if(!this.radarActive)return;
        if(this.lastFrame){const delta=Math.min((now-this.lastFrame)/1000,.08);const previous=this.radarAngle;this.radarAngle=(previous+delta*this.sweepSpeed)%360;if(this.radarAngle<previous)this.radarLoops++;}
        this.lastFrame=now;
        v.scene.requestRender();
        this.sweepRaf=requestAnimationFrame(tick);
      };
      this.sweepRaf=requestAnimationFrame(tick);
    },
    stopRadar(){this.radarActive=false;if(this.sweepRaf){cancelAnimationFrame(this.sweepRaf);this.sweepRaf=0;}this.lastFrame=0;},
    // Colour narrow DEM cells, not just the last point of each ray.
    // Coalesce consecutive cells of the same state to reduce entity count.
    drawResult(p,ray){
      const records=ray.records,step=p.distance/(p.count-1),half=180/p.directions;
      let first=1;
      const colour={visible:'#2ef18b',hidden:'#ff424d',uncertain:'#d0a83a',missing:'#777e8b'};
      const stateAt=i=>records[i]?.state||'missing';
      while(first<records.length){
        const state=stateAt(first);let last=first;
        while(last+1<records.length && stateAt(last+1)===state)last++;
        const near=Math.max(0,(first-.5)*step),far=Math.min(p.distance,(last+.5)*step);
        const points=[];
        const segmentCount=3;
        for(let k=0;k<=segmentCount;k++){
          const az=ray.azimuth-half+(2*half*k/segmentCount);
          const q=destination(p.lat,p.lon,az,far);points.push(q.lon/rad,q.lat/rad);
        }
        for(let k=segmentCount;k>=0;k--){
          const az=ray.azimuth-half+(2*half*k/segmentCount);
          const q=destination(p.lat,p.lon,az,near);points.push(q.lon/rad,q.lat/rad);
        }
        const entity=this.ext.view.entities.add({polygon:{hierarchy:Cesium.Cartesian3.fromDegreesArray(points),material:Cesium.Color.fromCssColorString(colour[state]||colour.missing).withAlpha(.46),heightReference:Cesium.HeightReference.CLAMP_TO_GROUND}});
        this.entities.push(entity);this.resultEntities.push(entity);
        first=last+1;
      }
    },
    async scan(){
      if(this.busy)return;
      const btn=this.$('hScan');
      try{
        const p=this.params(),provider=this.terrain();
        this.clear();this.cancelled=false;this.busy=true;btn.disabled=true;this.$('hCancel').disabled=false;
        this.beginRadar(p);
        const total=p.directions;
        this.$('hSummary').textContent=`Radar đang quay · 0/${total} hướng DEM hoàn thành`;
        // Terrain requests are sequential to avoid flooding Cesium ion.
        // The sweep animation keeps running at display refresh rate.
        for(let i=0;i<total;i++){
          if(this.cancelled)break;
          const az=i*360/total;
          const records=await this.profile(p,provider,az);
          if(this.cancelled)break;
          const ray={azimuth:az,records};this.rays.push(ray);
          this.drawResult(p,ray);
          const percent=Math.round((i+1)/total*100);
          this.$('hSummary').textContent=`Radar đang quay ${Math.round(this.radarAngle)}° · ${i+1}/${total} hướng DEM · ${percent}% · Xanh: nhìn thấy / Đỏ: bị che / Xám: thiếu dữ liệu`;
          await new Promise(resolve=>setTimeout(resolve,0));
        }
        if(this.cancelled){this.setReady(false);this.$('hSummary').textContent=`Đã dừng: ${this.rays.length}/${total} hướng. Các vùng đã tính vẫn hiển thị.`;}
        else{
          this.setReady(true);
          this.$('hSummary').textContent=`Hoàn tất ${total} hướng × ${p.count} mẫu. Radar tiếp tục quay; màu xanh/đỏ là kết quả DEM đã tính, không phải phép đo radar thật. Có thể chọn phương vị để xem mặt cắt.`;
          this.ext.app.notify('DEM đã quét xong. Radar tiếp tục quay; chọn phương vị để xem mặt cắt.');
        }
      }catch(e){this.stopRadar();this.setReady(false);this.$('hSummary').textContent=`Quét chưa hoàn tất: ${e.message}`;this.ext.app.notify(e.message,'error');}
      finally{this.busy=false;btn.disabled=false;this.$('hCancel').disabled=false;}
    },
    async run(){
      if(!this.scanned || this.busy){this.ext.app.notify('Phải quét đủ 360° trước.','error');return;}
      const btn=this.$('hRun');
      try{
        const p=this.params(),provider=this.terrain(),az=this.ext.number('hAzimuth',0,359.999);
        this.busy=true;btn.disabled=true;this.$('hSummary').textContent=`Đang phân tích phương vị ${az}°...`;
        this.records=await this.profile(p,provider,az);
        this.radarAngle=az;
        const coords=this.records.flatMap(r=>[r.longitude,r.latitude]);
        this.entities.push(this.ext.view.entities.add({polyline:{positions:Cesium.Cartesian3.fromDegreesArray(coords),width:5,material:Cesium.Color.YELLOW,clampToGround:true}}));
        this.chart();
        const visible=this.records.filter(r=>r.state==='visible').length,hidden=this.records.filter(r=>r.state==='hidden').length;
        this.$('hSummary').textContent=`Phương vị ${az}° · Hiện ${visible} · Khuất ${hidden} · Thiếu/chưa chắc chắn ${this.records.length-1-visible-hidden}.\nĐường vàng là hướng đang chọn; các vùng xanh/đỏ biểu diễn kết quả DEM theo ô quét.`;
      }catch(e){this.$('hSummary').textContent=`Lỗi: ${e.message}`;this.ext.app.notify(e.message,'error');}
      finally{this.busy=false;btn.disabled=false;}
    },
    chart(){
      const data=this.records.filter(r=>Number.isFinite(r.height));if(data.length<2){this.$('hChart').textContent='Không đủ DEM';return;}
      const W=340,H=190,l=38,r=8,t=12,b=27,min=Math.min(...data.map(x=>x.height))-20,max=Math.max(...data.map(x=>x.height))+20,maxD=this.records.at(-1).distance;
      const x=a=>l+a.distance/maxD*(W-l-r),y=a=>t+(max-a.height)/(max-min)*(H-t-b);
      let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mặt cắt DEM"><path d="M${l} ${t}V${H-b}H${W-r}" stroke="#7195b2" fill="none"/>`;
      let prev=null;for(const a of this.records){if(!Number.isFinite(a.height)){prev=null;continue;}if(prev)s+=`<path d="M${x(prev).toFixed(2)} ${y(prev).toFixed(2)}L${x(a).toFixed(2)} ${y(a).toFixed(2)}" stroke="${a.state==='visible'?'#62eba7':a.state==='hidden'?'#ffa25c':'#aaa'}" stroke-width="2.5"/>`;prev=a;}
      s+=`<text x="170" y="184" text-anchor="middle" fill="#bdd5eb" font-size="10">Cự ly 0–${(maxD/1000).toFixed(1)} km · DEM (m)</text></svg>`;this.$('hChart').innerHTML=s;
    },
    export(){if(!this.records.length){this.ext.app.notify('Chọn một phương vị trước khi xuất CSV','error');return;}const cols=['azimuth','distance','latitude','longitude','height','angle','horizon','state'];const lines=this.records.map(r=>cols.map(k=>r[k]??'').join(','));this.ext.download('horizon_360_selected_ray.csv','\uFEFF'+[cols.join(','),...lines].join('\n'),'text/csv;charset=utf-8');}
  };
  window.GeoExt.register('horizon',lab);
  window.GeoHorizonMath={destination,classify};
})();
