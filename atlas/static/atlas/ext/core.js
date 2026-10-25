/** Shared, intentionally small bridge between original v0.5 app and v0.6 labs. */
(function () {
  'use strict';
  const GeoExt = {
    view: null, app: null, activeTool: null,
    initModules: [],
    modules: {},
    $: id => document.getElementById(id),
    register(name, module) { this.modules[name] = module; },
    init(app) {
      this.app = app;
      this.view = app.viewer;
      for (const [name, module] of Object.entries(this.modules)) {
        try {
          Promise.resolve(module.init(this)).catch(err => console.error(name, err));
        } catch (err) { console.error('Lab module initialization failed:', name, err); }
      }
      this.sync();
    },
    setTool(tool) {
      if (tool && this.app?.cancelMeasure) this.app.cancelMeasure();
      this.activeTool = this.activeTool === tool ? null : tool;
      document.querySelectorAll('[data-geotool]').forEach(b => b.classList.toggle('selected', b.dataset.geotool === this.activeTool));
      return this.activeTool;
    },
    onMapClick(screen, coord) {
      if (!this.activeTool) return false;
      const module = this.modules[this.activeTool.split(':')[0]];
      if (!module?.onClick) return false;
      return !!module.onClick(screen, coord, this);
    },
    sync() {
      for (const [name, module] of Object.entries(this.modules)) {
        try { module.sync?.(this); } catch (err) { console.warn('Sync', name, err); }
      }
    },
    download(name, text, contentType='text/plain;charset=utf-8') {
      const url=URL.createObjectURL(new Blob([text],{type:contentType}));
      const a=document.createElement('a'); a.href=url; a.download=name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    },
    safeText(node,text) { if(node) node.textContent=String(text); },
    number(id,min,max) {
      const n=Number(this.$(id)?.value);
      if(!Number.isFinite(n) || n<min || n>max) throw new Error(`${id}: nhập số trong khoảng ${min} đến ${max}`);
      return n;
    }
  };
  window.GeoExt = GeoExt;
})();
