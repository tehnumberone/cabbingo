// Exercising a `max-width` media query needs a genuinely narrow viewport, and headless
// chrome clamps --window-size at roughly 470px. Karma runs specs inside a context iframe,
// and styles inside an iframe resolve against the iframe's own viewport — so narrowing
// that element is the one thing that makes the phone breakpoint actually fire.
//
// Call from beforeAll and always call the returned restore from afterAll: every other spec
// in the suite measures at desktop width and will fail if this leaks.

export const PHONE_WIDTH = 390;
const BOOTSTRAP_CSS = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';

// styles.css leans on bootstrap for gaps and padding, and index.html loads it from a CDN
// rather than the bundle, so the karma page has to pull it in or measurements are meaningless.
export async function loadBootstrap(): Promise<void> {
  if (!document.querySelector(`link[href="${BOOTSTRAP_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BOOTSTRAP_CSS;
    document.head.appendChild(link);
    await new Promise((resolve, reject) => {
      link.onload = resolve;
      link.onerror = () => reject(new Error(`could not load ${BOOTSTRAP_CSS}`));
    });
  }
  // Without the real Runescape metrics these measurements are Times New Roman's.
  await document.fonts.ready;
}

export async function usePhoneViewport(width = PHONE_WIDTH): Promise<() => void> {
  await loadBootstrap();

  const frame = window.frameElement as HTMLElement | null;
  const previous = frame?.style.width ?? '';
  if (frame) {
    frame.style.width = `${width}px`;
    frame.style.minWidth = `${width}px`;
  }
  await new Promise((r) => setTimeout(r, 120));

  return () => {
    if (frame) {
      frame.style.width = previous;
      frame.style.minWidth = '';
    }
  };
}
