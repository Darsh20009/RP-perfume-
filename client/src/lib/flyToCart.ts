/**
 * Fly-to-cart animation: animates a small image from a source element
 * to the cart icon (any element marked with `data-cart-target="true"`).
 * Falls back silently if either is missing or the user prefers reduced motion.
 */
export function flyToCart(sourceEl: Element | null, imageUrl: string) {
  try {
    if (!sourceEl) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const target = document.querySelector('[data-cart-target="true"]') as HTMLElement | null;
    if (!target) return;

    const srcRect = (sourceEl as HTMLElement).getBoundingClientRect();
    const dstRect = target.getBoundingClientRect();

    const startX = srcRect.left + srcRect.width / 2;
    const startY = srcRect.top + srcRect.height / 2;
    const endX = dstRect.left + dstRect.width / 2;
    const endY = dstRect.top + dstRect.height / 2;

    const node = document.createElement("img");
    node.src = imageUrl;
    node.alt = "";
    node.style.cssText = `
      position: fixed;
      left: ${startX - 28}px;
      top: ${startY - 28}px;
      width: 56px;
      height: 56px;
      object-fit: cover;
      border-radius: 9999px;
      box-shadow: 0 12px 30px -8px rgba(26,39,68,0.45), 0 0 0 3px #DFB369;
      pointer-events: none;
      z-index: 9999;
      transition: transform 700ms cubic-bezier(0.6, -0.28, 0.735, 0.045), opacity 200ms ease 600ms;
      transform: translate(0,0) scale(1) rotate(0deg);
      will-change: transform, opacity;
      background: white;
    `;
    document.body.appendChild(node);

    // Trigger animation on next frame
    requestAnimationFrame(() => {
      const dx = endX - startX;
      const dy = endY - startY;
      node.style.transform = `translate(${dx}px, ${dy}px) scale(0.15) rotate(360deg)`;
      node.style.opacity = "0.1";
    });

    // Pulse cart icon when arrived
    setTimeout(() => {
      target.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.35)" },
          { transform: "scale(1)" },
        ],
        { duration: 380, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
      );
    }, 680);

    setTimeout(() => node.remove(), 850);
  } catch {
    // best-effort, never throw from an animation
  }
}
