/* Display-only localization. Never modifies IDs, URLs, API keys or event handlers. */
(()=>{'use strict';
const page=location.pathname;
const setText=(sel,value)=>{const e=document.querySelector(sel);if(e)e.textContent=value};
const replaceText=(sel,from,to)=>{const e=document.querySelector(sel);if(e&&e.textContent.includes(from))e.textContent=e.textContent.replace(from,to)};
const addBrand=(parent,content)=>{if(!parent||parent.querySelector('.vinh-brandline'))return;const e=document.createElement('p');e.className='vinh-brandline';e.textContent=content;parent.prepend(e)};
function apply(){
 if(page==='/'){
  document.title='Bùi Quang Vinh | Hệ thống Tình báo Địa không gian';
  const title=document.querySelector('.title-row h1');if(title)title.textContent='GEOINT · BÙI QUANG VINH';
  setText('.map-brand strong','HỆ THỐNG ĐỊA KHÔNG GIAN');
  setText('.osint-entry-heading strong','TRUNG TÂM TÌNH BÁO NGUỒN MỞ');
  setText('.osint-entry-heading small','Bùi Quang Vinh · Thu thập và phân tích');
  setText('.osint-primary-link','Mở Trung tâm Nguồn mở ↗');
  const sidebar=document.querySelector('.sidebar-header')||document.querySelector('.sidebar');addBrand(sidebar,'NỀN TẢNG NGHIÊN CỨU · BÙI QUANG VINH');
  replaceText('#tabGeoLab','GeoLab','Phòng thí nghiệm');
  replaceText('#tabHorizon','Horizon','Địa hình');
 }else if(page.includes('/api/intelligence/analysis/')){
  document.title='Bùi Quang Vinh | Trung tâm Phân tích AI';
  setText('header h1','Trung tâm Phân tích Trí tuệ nhân tạo Bùi Quang Vinh');
  addBrand(document.querySelector('header > div')||document.querySelector('header'),'BÙI QUANG VINH · PHÒNG PHÂN TÍCH');
 }else if(page.includes('/api/intelligence/dashboard/')){
  document.title='Bùi Quang Vinh | Trung tâm Tình báo Nguồn mở';
  setText('header h1','Trung tâm Tình báo Nguồn mở Bùi Quang Vinh');
  addBrand(document.querySelector('header > div')||document.querySelector('header'),'BÙI QUANG VINH · TRUNG TÂM ĐIỀU HÀNH');
  const labels={'inbox':'Hộp tiếp nhận','sources':'Danh mục nguồn','cases':'Hồ sơ nghiên cứu','brief':'Bản tin hằng ngày','runs':'Nhật ký thu thập','decisions':'Phê duyệt'};
  for(const [key,value] of Object.entries(labels))setText('[data-tab="'+key+'"]',value);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
