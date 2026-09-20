/**
 * Visual treatment for the served AFTERSIGN kiosk return beat.
 *
 * The scene owner calls this with the element that contains #line and
 * #ioReturnLine. Keeping the treatment scoped prevents it from leaking into
 * other story surfaces when the kiosk is mounted or unmounted repeatedly.
 */
export function applyKioskSceneVisual(surface) {
  if (!(surface instanceof HTMLElement)) return () => {};

  const previousClass = surface.classList.contains("aftersign-kiosk-scene");
  surface.classList.add("aftersign-kiosk-scene");

  const style = document.createElement("style");
  style.dataset.aftersignKioskVisual = "true";
  style.textContent = `
    .aftersign-kiosk-scene {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      background:
        radial-gradient(circle at 74% 14%, rgb(255 193 101 / 18%), transparent 29rem),
        radial-gradient(circle at 15% 82%, rgb(67 151 170 / 16%), transparent 25rem),
        linear-gradient(145deg, #07141c, #10151d 54%, #1f1720);
      box-shadow: inset 0 0 0 1px rgb(222 196 147 / 14%), inset 0 0 5rem rgb(0 0 0 / 34%);
    }
    .aftersign-kiosk-scene::before {
      content: "";
      position: absolute;
      z-index: -1;
      inset: 0;
      pointer-events: none;
      opacity: .45;
      background-image: linear-gradient(rgb(255 255 255 / 3%) 1px, transparent 1px);
      background-size: 100% 4px;
      mix-blend-mode: soft-light;
    }
    .aftersign-kiosk-scene #ioReturnLine {
      display: block;
      margin: .65rem 0 0;
      color: #f5d9a1;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: .025em;
      text-shadow: 0 0 .75rem rgb(255 181 79 / 42%);
      animation: aftersign-kiosk-arrival 420ms ease-out both;
    }
    @keyframes aftersign-kiosk-arrival {
      from { opacity: 0; transform: translateY(.4rem); filter: blur(2px); }
      to { opacity: 1; transform: translateY(0); filter: blur(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .aftersign-kiosk-scene #ioReturnLine { animation: none; }
    }
  `;
  document.head.append(style);

  return () => {
    style.remove();
    if (!previousClass) surface.classList.remove("aftersign-kiosk-scene");
  };
}
