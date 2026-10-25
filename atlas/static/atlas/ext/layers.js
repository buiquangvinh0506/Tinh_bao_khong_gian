/** Layer Manager: base imagery, terrain, places, Google 3D, persisted GLB + session GeoJSON overlays. */
(function(){
  'use strict';
  const example={type:'FeatureCollection',features:[
    {type:'Feature',properties:{name:'Tuyến minh họa công viên đô thị'},geometry:{type:'LineString',coordinates:[[105.836,21.034],[105.842,21.030],[105.849,21.029]]}},
    {type:'Feature',properties:{name:'Đa giác nghiên cứu minh họa'},geometry:{type:'Polygon',coordinates:[[[105.830,21.025],[105.835,21.025],[105.835,21.029],[105.830,21.029],[105.830,21.025]]]}}
  ]};
  const module={
    overlays:[],
    init(ext){
      this.ext=ext;this.$=ext.$;
      this.$('layerFile').addEventListener('change',e=>this.import(e));
      this.$('layerExample').addEventListener('click',()=>this.add(example,'Lớp mẫu — minh họa (không đo đạc)'));
      this.$('layerClear').addEventListener('click',()=>this.clear());
      window.addEventListener('geoint:scene-changed',()=>this.render());
      this.render();
    },
    async import(event){
      const file=event.target.files?.[0];
      if(!file)return;
      try{
        if(file.size>5*1024*1024)throw new Error('Tệp GeoJSON lớn hơn 5 MB');
        const data=JSON.parse(await file.text());
        if(!data || !['FeatureCollection','Feature','Point','LineString','Polygon','MultiPoint','MultiLineString','MultiPolygon'].includes(data.type))throw new Error('GeoJSON không hợp lệ');
        await this.add(data,file.name);
      }catch(e){this.$('layerStatus').textContent=e.message;this.ext.app.notify(e.message,'error');}
      finally{event.target.value='';}
    },
    async add(data,name){
      if(this.overlays.length>=12)throw new Error('Tối đa 12 lớp GeoJSON tạm. Hãy xóa lớp cũ.');
      try{
        const ds=await Cesium.GeoJsonDataSource.load(data,{
          clampToGround:true,
          stroke:Cesium.Color.fromCssColorString('#66e8c0'),
          strokeWidth:3,
          fill:Cesium.Color.fromCssColorString('#37ccad').withAlpha(0.32),
          markerColor:Cesium.Color.fromCssColorString('#ffcb72'),markerSize:22
        });
        // Avoid injecting HTML into the Cesium InfoBox from arbitrary GeoJSON fields.
        for(const entity of ds.entities.values){
          if(entity.description)entity.description=undefined;
          if(entity.properties?.name?.getValue)entity.name=String(entity.properties.name.getValue(Cesium.JulianDate.now()));
        }
        await this.ext.view.dataSources.add(ds);
        this.overlays.push({name,ds,shown:true,id:Math.random().toString(36).slice(2)});
        this.$('layerStatus').textContent=`Đã nạp ${name}. Dữ liệu này chỉ ở trong phiên trình duyệt.`;
        this.render();this.ext.app.notify(`Đã nạp lớp ${name}`);
      }catch(e){this.$('layerStatus').textContent=`Không nạp được lớp: ${e.message}`;this.ext.app.notify(e.message,'error');}
    },
    clear(){
      for(const o of this.overlays)this.ext.view.dataSources.remove(o.ds,true);
      this.overlays=[];this.render();this.$('layerStatus').textContent='Đã xóa toàn bộ lớp GeoJSON tạm.';
    },
    row(name,desc,checked,onChange,actions){
      const el=document.createElement('div');el.className='layer-row';
      const label=document.createElement('label');label.className='switchline';
      const title=document.createElement('span');title.textContent=name;
      const check=document.createElement('input');check.type='checkbox';check.checked=Boolean(checked);
      check.addEventListener('change',()=>{onChange(check.checked);this.render();});
      label.append(title,check);
      const info=document.createElement('small');info.textContent=desc;
      el.append(label,info);
      if(actions?.length){
        const bar=document.createElement('div');bar.className='place-actions';
        for(const [text,fn] of actions){const button=document.createElement('button');button.type='button';button.textContent=text;button.addEventListener('click',fn);bar.append(button);}
        el.appendChild(bar);
      }
      return el;
    },
    render(){
      const ext=this.ext,view=ext.view;
      if(!view)return;
      const el=this.$('layerList');el.replaceChildren();
      const app=ext.app;
      el.append(this.row('Ảnh nền Cesium ion','Tầng imagery — chỉ ảnh, không tạo độ cao',Boolean(app.getImagery()?.show),show=>{
        const layer=app.getImagery();if(layer)layer.show=show;
      }));
      el.append(this.row('World Terrain (DEM)','Bề mặt địa hình; chỉ có tác dụng khi không bật Google 3D',Boolean(this.$('terrainSwitch').checked),show=>{
        if(app.isGoogleActive())return ext.app.notify('Tắt Google 3D trước','error');
        const check=this.$('terrainSwitch');check.checked=show;check.dispatchEvent(new Event('change'));
      }));
      el.append(this.row('Hồ sơ PostgreSQL','Điểm địa lý đang được lọc từ cơ sở dữ liệu',Boolean(this.$('placesSwitch').checked),show=>{
        const check=this.$('placesSwitch');check.checked=show;check.dispatchEvent(new Event('change'));
      }));
      el.append(this.row('Google Photorealistic 3D','Nguồn 3D Tiles thương mại — bật khi cần, có hạn mức',app.isGoogleActive(),()=>{
        this.$('toggleGoogle3D').click();
      }));
      const models=ext.modules.models;
      el.append(this.row('GLB riêng của tôi',`Mô hình lưu trên Django (${models.models.length})`,models.enabled,show=>models.setVisible(show)));
      for(const overlay of [...this.overlays]){
        el.append(this.row(`GeoJSON: ${overlay.name}`,'Lớp tạm trong trình duyệt · không ghi vào PostgreSQL',overlay.shown,show=>{
          overlay.shown=show;overlay.ds.show=show;
        },[
          ['↑ Trên cùng',()=>{view.dataSources.raiseToTop(overlay.ds);this.render();}],
          ['× Xóa',()=>{view.dataSources.remove(overlay.ds,true);this.overlays=this.overlays.filter(o=>o!==overlay);this.render();}]
        ]));
      }
    },
    sync(){this.render();}
  };
  window.GeoExt.register('layers',module);
})();
