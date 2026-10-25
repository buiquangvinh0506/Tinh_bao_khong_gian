/** Local GLB Model Factory: upload -> Django file storage -> Cesium.Model primitive. */
(function(){
  'use strict';
  const module={
    models:[],primitives:new Map(),enabled:true,
    init(ext){
      this.ext=ext;this.$=ext.$;
      const button=this.$('modelPick');button.dataset.geotool='models:place';
      button.addEventListener('click',()=>{
        const selected=ext.setTool('models:place');
        ext.app.notify(selected?'Nhấp vị trí để đặt mô hình GLB':'Đã dừng chọn vị trí.');
      });
      this.$('modelUploadForm').addEventListener('submit',e=>this.upload(e));
      this.$('modelFile').addEventListener('change',()=>this.describeSelection());
      this.$('modelRefresh').addEventListener('click',()=>this.reload());
      return this.reload();
    },
    onClick(_screen,c){
      if(!c){this.ext.app.notify('Chưa lấy được vị trí','error');return true;}
      this.$('modelLat').value=Cesium.Math.toDegrees(c.latitude).toFixed(6);
      this.$('modelLon').value=Cesium.Math.toDegrees(c.longitude).toFixed(6);
      if(Number.isFinite(c.height))this.$('modelHeight').value=c.height.toFixed(2);
      this.ext.setTool('models:place');
      this.ext.app.notify('Đã lấy tọa độ đặt mô hình. Chỉnh tỉ lệ, độ cao và chọn GLB.');
      return true;
    },
    async reload(){
      try{
        const response=await fetch('/api/models/',{credentials:'same-origin'});
        if(!response.ok)throw new Error(`GET /api/models/: HTTP ${response.status}`);
        const result=await response.json();
        if(!Array.isArray(result.models))throw new Error('API models không hợp lệ');
        // Remove obsolete primitives, do not discard visible model list on network failure.
        const liveIds=new Set(result.models.map(x=>x.id));
        for(const [id,model] of this.primitives){
          if(!liveIds.has(id)) {this.ext.view.scene.primitives.remove(model);this.primitives.delete(id);}
        }
        this.models=result.models;
        this.renderList();
        for(const item of this.models)if(!this.primitives.has(item.id))await this.loadModel(item);
        this.ext.sync();
      }catch(e){this.$('modelStatus').textContent=`Lỗi mô hình: ${e.message}`;console.error(e);}
    },
    async loadModel(item){
      if(!item.url?.startsWith('/media/'))throw new Error('Đường dẫn mô hình không hợp lệ');
      const coords=Cesium.Cartesian3.fromDegrees(item.longitude,item.latitude,item.height);
      const rotation=new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(item.heading),0,0);
      const matrix=Cesium.Transforms.headingPitchRollToFixedFrame(coords,rotation);
      try{
        const model=await Cesium.Model.fromGltfAsync({url:item.url,modelMatrix:matrix,scale:item.scale,maximumScale:1000,minimumPixelSize:0,id:{geoModelId:item.id}});
        this.primitives.set(item.id,this.ext.view.scene.primitives.add(model));
        model.show=this.enabled;
      }catch(error){
        this.$('modelStatus').textContent=`Mô hình ${item.name} không dựng được: ${error.message}`;
        console.error('GLB loading error',item,error);
      }
    },
    setVisible(enabled){this.enabled=enabled;for(const model of this.primitives.values())model.show=enabled;},
    renderList(){
      const box=this.$('modelList');box.replaceChildren();
      this.$('modelCount').textContent=String(this.models.length);
      if(!this.models.length){box.textContent='Chưa có mô hình GLB được lưu.';return;}
      for(const item of this.models){
        const row=document.createElement('article');row.className='place';
        const heading=document.createElement('strong');heading.className='place-name';heading.textContent=item.name;
        const p=document.createElement('div');p.className='place-coords';p.textContent=`${item.latitude.toFixed(5)}°, ${item.longitude.toFixed(5)}° · ${item.height.toFixed(1)} m · ×${item.scale}`;
        const actions=document.createElement('div');actions.className='place-actions';
        const fly=document.createElement('button');fly.textContent='◎ Bay tới';
        fly.addEventListener('click',()=>this.ext.view.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(item.longitude,item.latitude,item.height+260),duration:2}));
        const del=document.createElement('button');del.textContent='× Xóa';del.className='delete';
        del.addEventListener('click',()=>this.remove(item));
        actions.append(fly,del);row.append(heading,p,actions);box.appendChild(row);
      }
    },
    formatSize(bytes){
      return bytes >= 1024*1024 ? `${(bytes/(1024*1024)).toFixed(2)} MiB` : `${(bytes/1024).toFixed(1)} KiB`;
    },
    describeSelection(){
      const files=Array.from(this.$('modelFile').files || []);
      const summary=this.$('modelSelectionSummary'), list=this.$('modelSelectionList');
      list.replaceChildren();
      const total=files.reduce((sum,file)=>sum+file.size,0);
      summary.textContent=files.length
        ? `Đã chọn ${files.length} mô hình · Tổng dung lượng: ${this.formatSize(total)} · Giới hạn: 500 MiB/tệp`
        : 'Chưa chọn mô hình nào · Giới hạn 500 MiB/tệp.';
      for(const file of files){
        const row=document.createElement('div');row.className='model-selection-item';
        const invalid=file.size<20 || file.size>500*1024*1024 || !file.name.toLowerCase().endsWith('.glb');
        if(invalid)row.classList.add('invalid');
        const name=document.createElement('span');name.textContent=file.name+(invalid?' · không hợp lệ':'');
        const size=document.createElement('span');size.textContent=this.formatSize(file.size);
        row.append(name,size);list.append(row);
      }
    },
    async upload(event){
      event.preventDefault();
      const files=Array.from(this.$('modelFile').files || []);
      const button=this.$('modelSubmit'), status=this.$('modelStatus');
      const progress=this.$('modelUploadProgress');
      const ext=this.ext;
      let success=0;const errors=[];
      try{
        if(!files.length)throw new Error('Chưa chọn GLB');
        if(this.models.length+files.length>100)throw new Error('Vượt giới hạn 100 mô hình trong kho');
        for(const file of files){
          if(!file.name.toLowerCase().endsWith('.glb')||file.size<20||file.size>500*1024*1024)
            throw new Error(`Tệp ${file.name} phải là GLB từ 20 byte đến 500 MiB`);
          const header=new DataView(await file.slice(0,12).arrayBuffer());
          if(header.byteLength<12||header.getUint32(0,true)!==0x46546c67||
             header.getUint32(4,true)!==2||header.getUint32(8,true)!==file.size)
            throw new Error(`Header GLB không hợp lệ: ${file.name}`);
        }
        const baseName=this.$('modelName').value.trim();
        if(!baseName)throw new Error('Chưa đặt tên mô hình');
        const latitude=ext.number('modelLat',-90,90),longitude=ext.number('modelLon',-180,180);
        let height=ext.number('modelHeight',-1000,12000);
        const scale=ext.number('modelScale',0.001,1000),heading=ext.number('modelHeading',-360,360);
        if(this.$('modelSnapGround').checked){
          const provider=ext.app.getTerrain();
          if(!provider)throw new Error('Chưa có DEM; bỏ chọn lấy độ cao nền nếu muốn nhập thủ công.');
          const sampled=await Cesium.sampleTerrainMostDetailed(provider,[Cesium.Cartographic.fromDegrees(longitude,latitude)]);
          if(!Number.isFinite(sampled[0].height))throw new Error('DEM không có độ cao tại điểm này');
          height=sampled[0].height;this.$('modelHeight').value=height.toFixed(2);
        }
        button.disabled=true;progress.hidden=false;progress.value=0;
        for(let i=0;i<files.length;i++){
          const file=files[i];
          const name=files.length===1?baseName:`${baseName} - ${file.name.replace(/\.glb$/i,'')}`.slice(0,160);
          const body=new FormData();body.append('model',file);body.append('name',name);
          for(const [key,value] of Object.entries({longitude,latitude,height,scale,heading,source_url:this.$('modelSource').value.trim()}))
            body.append(key,String(value));
          status.textContent=`Đang gửi ${i+1}/${files.length}: ${file.name} (${this.formatSize(file.size)})...`;
          try{
            const response=await fetch('/api/models/',{method:'POST',body,headers:{'X-CSRFToken':ext.app.csrf},credentials:'same-origin'});
            const result=await response.json().catch(()=>({}));
            if(!response.ok)throw new Error(result.error||`HTTP ${response.status}`);
            success++;
          }catch(error){errors.push(`${file.name}: ${error.message}`);}
          progress.value=Math.round((i+1)/files.length*100);
        }
        await this.reload();
        status.textContent=`Hoàn tất: ${success}/${files.length} mô hình đã lưu.`+
          (errors.length?` Lỗi: ${errors.join(' | ')}`:'');
        if(success===files.length){this.$('modelUploadForm').reset();this.describeSelection();}
        ext.app.notify(status.textContent,errors.length?'error':undefined);
      }catch(error){status.textContent=`Lỗi: ${error.message}`;ext.app.notify(error.message,'error');}
      finally{button.disabled=false;progress.hidden=true;}
    },
    async remove(item){
      if(!confirm(`Xóa mô hình ${item.name} và tệp GLB khỏi máy?`))return;
      try{
        const r=await fetch(`/api/models/${item.id}/`,{method:'DELETE',headers:{'X-CSRFToken':this.ext.app.csrf},credentials:'same-origin'});
        if(!r.ok)throw new Error(`HTTP ${r.status}`);
        await this.reload();this.ext.app.notify('Đã xóa mô hình.');
      }catch(e){this.ext.app.notify(`Không xóa được mô hình: ${e.message}`,'error');}
    },
    sync(){}
  };
  window.GeoExt.register('models',module);
})();
