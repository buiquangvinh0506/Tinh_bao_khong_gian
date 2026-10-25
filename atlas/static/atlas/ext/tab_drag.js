/** Drag-to-scroll tab rail, preserves click and keyboard navigation. */
(() => {
  'use strict';
  const rail = document.getElementById('workspaceTabs');
  if (!rail) return;
  let startX = 0, startScroll = 0, pointerId = null, moved = false, suppressClick = false;
  rail.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    pointerId = e.pointerId; startX = e.clientX; startScroll = rail.scrollLeft; moved = false; suppressClick = false;
  });
  rail.addEventListener('pointermove', (e) => {
    if (pointerId !== e.pointerId) return;
    const delta = e.clientX - startX;
    if (!moved && Math.abs(delta) > 5) { moved = true; rail.classList.add('dragging'); rail.setPointerCapture(e.pointerId); }
    if (moved) { rail.scrollLeft = startScroll - delta; e.preventDefault(); }
  });
  function end(e) {
    if (pointerId !== e.pointerId) return;
    if (moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
    if (rail.hasPointerCapture(e.pointerId)) rail.releasePointerCapture(e.pointerId);
    rail.classList.remove('dragging'); pointerId = null; moved = false;
  }
  rail.addEventListener('pointerup', end);
  rail.addEventListener('pointercancel', end);
  rail.addEventListener('click', (e) => { if (suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  rail.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      rail.scrollBy({left:e.key === 'ArrowRight' ? 130 : -130, behavior:'smooth'}); e.preventDefault();
    }
  });
})();
