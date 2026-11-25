/** How long each video is watched before the next swipe, in ms. Stalls are counted in this window. */
export const WATCH_MS = 3000;
/** A video that has not played by now counts as failed, and as this many ms in the statistics. */
export const TIMEOUT_MS = 90_000;
/** Swipes after the first video, in each session. */
export const SWIPES = 5;
