/* Camera + GPU scene introspection. Positions shown in WGS84 ellipsoid reference. */
(function(){
  'use strict';
  const module={
    init(ext){
      this.ext=ext;
      this.$=ext.$;
      this.$('labInspect').dataset.geotool='geolab:inspect';
      this.$('labInspect').addEventListener('click',()=>{
        const active=ext.setTool('geolab:inspect');
        this.$('labInspect').classList.toggle('selected', !!active);
        ext.app.notify(active ? 'GeoLab: nhấp lên địa cầu hoặc mô hình 3D để kiểm tra tọa độ.' : 'Đã thoát chọn tọa độ.');
      });
      this.$('labFps').addEventListener('click',()=>{
        const s=ext.view.scene;
        s.debugShowFramesPerSecond=!s.debugShowFramesPerSecond;
        this.$('labFps').textContent=`FPS: ${s.debugShowFramesPerSecond?'Bật':'Tắt'}`;
      });
      this.$('labApplyCamera').addEventListener('click',()=>{
        try {
          const height=ext.number('labCamHeight',50,20000000);
          const heading=ext.number('labCamHeading',0,360);
          const pitch=ext.number('labCamPitch',-90,-5);
          const carto=ext.view.camera.positionCartographic;
          ext.view.camera.flyTo({
            destination:Cesium.Cartesian3.fromRadians(carto.longitude,carto.latitude,height),
            orientation:{heading:Cesium.Math.toRadians(heading),pitch:Cesium.Math.toRadians(pitch),roll:0}, duration:1.8
          });
        }catch(e){ext.app.notify(e.message,'error');}
      });
      this.$('labSaveCamera').addEventListener('click',()=>{
        try{localStorage.setItem('geoint.camera.v06',JSON.stringify(this.snapshot()));ext.app.notify('Đã lưu góc nhìn camera vào trình duyệt.');}
        catch(e){ext.app.notify(`Không lưu được: ${e.message}`,'error');}
      });
      this.$('labRestoreCamera').addEventListener('click',()=>{
        try{
          const snap=JSON.parse(localStorage.getItem('geoint.camera.v06'));
          if(!snap) throw new Error('Chưa lưu góc nhìn nào');
          this.flyTo(snap);
        }catch(e){ext.app.notify(e.message,'error');}
      });
      this.$('labCopyCamera').addEventListener('click',async()=>{
        const snapshot=JSON.stringify(this.snapshot(),null,2);
        try{await navigator.clipboard.writeText(snapshot);ext.app.notify('Đã sao chép camera dưới dạng JSON.');}
        catch{ext.download('camera_geoint.json',snapshot,'application/json');}
      });
      ext.view.camera.changed.addEventListener(()=>{
        const now=Date.now(); if(now-(this.lastUpdate||0)<350)return;
        this.lastUpdate=now;this.update();
      });
      this.update();
    },
    snapshot(){
      const c=this.ext.view.camera,p=c.positionCartographic;
      return {longitude:Cesium.Math.toDegrees(p.longitude),latitude:Cesium.Math.toDegrees(p.latitude),
        height:p.height,heading:Cesium.Math.toDegrees(c.heading),pitch:Cesium.Math.toDegrees(c.pitch),roll:Cesium.Math.toDegrees(c.roll)};
    },
    flyTo(c){
      const values=Object.values(c);if(values.some(x=>!Number.isFinite(Number(x))))throw new Error('Snapshot camera không hợp lệ');
      this.ext.view.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(c.longitude,c.latitude,c.height),
        orientation:{heading:Cesium.Math.toRadians(c.heading),pitch:Cesium.Math.toRadians(c.pitch),roll:Cesium.Math.toRadians(c.roll)},duration:2});
    },
    update(){
      const c=this.snapshot();
      this.$('labCameraInfo').textContent=`Lon ${c.longitude.toFixed(5)}° | Lat ${c.latitude.toFixed(5)}°\nCamera ${c.height.toFixed(1)} m | H ${c.heading.toFixed(1)}° | P ${c.pitch.toFixed(1)}°`;
    },
    onClick(screen,coord){
      if(!coord) {this.ext.app.notify('Chưa chọn được vị trí 3D','error');return true;}
      const p=Cesium.Cartesian3.fromRadians(coord.longitude,coord.latitude,coord.height);
      this.$('labReadout').textContent=
        `WGS84 longitude: ${Cesium.Math.toDegrees(coord.longitude).toFixed(7)}°\n`+
        `latitude: ${Cesium.Math.toDegrees(coord.latitude).toFixed(7)}°\n`+
        `height ellipsoid: ${coord.height.toFixed(2)} m\n`+
        `ECEF X=${p.x.toFixed(2)} m\nY=${p.y.toFixed(2)} m\nZ=${p.z.toFixed(2)} m\n`+
        `Chú ý: độ cao từ Google 3D Tiles là bề mặt dựng hình, không phải đo kiểm địa chính.`;
      this.ext.app.notify('GeoLab đã ghi nhận điểm 3D.');
      return true;
    }
  };
  window.GeoExt.register('geolab',module);
})();
