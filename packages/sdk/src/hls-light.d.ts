// hls.js ships a smaller "light" build (no subtitles or DRM, which a short-video feed doesn't need)
// without its own type declarations. It has the same API, so reuse the main ones.
declare module 'hls.js/light' {
  import Hls from 'hls.js';
  export default Hls;
}
