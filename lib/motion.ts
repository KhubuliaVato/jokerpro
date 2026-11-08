/** The site's own switch for animated backgrounds, frames, names and effects. It does not follow the system's "reduce motion": the paid cosmetics are meant to move, and whoever wants quiet turns them off here. */
const KEY = "motion";

export const MOTION_CHANGED = "motion:changed";

export function motionOff(): boolean {
  try {
    return localStorage.getItem(KEY) === "off";
  } catch {
    return false;
  }
}

export function setMotionOff(off: boolean) {
  try {
    if (off) localStorage.setItem(KEY, "off");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage is blocked: the switch lasts until the page is closed */
  }
  if (off) document.documentElement.dataset.motion = "off";
  else delete document.documentElement.dataset.motion;
  window.dispatchEvent(new Event(MOTION_CHANGED));
}
