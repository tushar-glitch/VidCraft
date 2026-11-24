const CSS = `
.vc-feed{position:relative;width:100%;height:100%;background:#000;color:#fff;overflow:hidden;outline:none;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.vc-scroller{position:absolute;inset:0;overflow-y:scroll;scroll-snap-type:y mandatory;overscroll-behavior:contain;scrollbar-width:none}
.vc-scroller::-webkit-scrollbar{display:none}
.vc-slide{position:relative;height:100%;scroll-snap-align:start;scroll-snap-stop:always;overflow:hidden;background:#000;cursor:pointer}
.vc-poster,.vc-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:transparent}
.vc-landscape .vc-poster,.vc-landscape .vc-video{object-fit:contain}
.vc-meta{position:absolute;left:0;right:0;bottom:0;padding:48px 16px 18px;background:linear-gradient(transparent,rgba(0,0,0,.65));pointer-events:none}
.vc-title{font-size:15px;line-height:1.3;font-weight:500;text-shadow:0 1px 2px rgba(0,0,0,.6);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.vc-mute{position:absolute;top:12px;right:12px;z-index:2;width:40px;height:40px;border:0;border-radius:50%;background:rgba(0,0,0,.45);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.vc-mute:hover{background:rgba(0,0,0,.65)}
.vc-mute svg{width:20px;height:20px;fill:currentColor}
.vc-progress{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.25);z-index:2;pointer-events:none}
.vc-progress i{display:block;height:100%;width:0;background:#fff}
.vc-paused-icon{position:absolute;inset:0;z-index:1;display:none;align-items:center;justify-content:center;pointer-events:none}
.vc-paused-icon span{width:64px;height:64px;border-radius:50%;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center}
.vc-paused-icon svg{width:30px;height:30px;fill:#fff;margin-left:4px}
.vc-is-paused .vc-paused-icon{display:flex}
.vc-message{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;font-size:15px}
.vc-message button{border:1px solid rgba(255,255,255,.6);background:transparent;color:#fff;border-radius:8px;padding:8px 16px;cursor:pointer;font:inherit}
.vc-slide-error{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);z-index:1;text-align:center;font-size:14px;padding:0 24px;text-shadow:0 1px 2px #000;pointer-events:none}
`;

/** Adds the SDK's styles to the page once. They are all prefixed `vc-` so they can't clash with the host site. */
export function injectStyles(): void {
  if (document.querySelector('style[data-vidcraft]')) return;
  const style = document.createElement('style');
  style.dataset.vidcraft = '';
  style.textContent = CSS;
  document.head.appendChild(style);
}
