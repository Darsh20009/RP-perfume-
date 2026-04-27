import { useEffect } from "react";

const isDev = import.meta.env.DEV;

const ADMIN_PATH_PREFIXES = [
  "/admin",
  "/dashboard",
  "/branch-dashboard",
  "/employees",
  "/pos",
  "/cash-drawer",
  "/vendor-dashboard",
];

function isPrivilegedPath(): boolean {
  const path = window.location.pathname || "";
  return ADMIN_PATH_PREFIXES.some(p => path.startsWith(p));
}

export function useBlockInspect() {
  useEffect(() => {
    if (isDev) return;

    const handleContextMenu = (e: MouseEvent) => {
      if (isPrivilegedPath()) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPrivilegedPath()) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      const k = (e.key || "").toLowerCase();

      if (k === "f12") {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === "i" || k === "j" || k === "c")) {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (k === "u" || k === "s")) {
        e.preventDefault();
        return;
      }
    };

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "img") e.preventDefault();
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("dragstart", handleDragStart);

    const styleEl = document.createElement("style");
    styleEl.id = "rf-inspect-block-style";
    styleEl.textContent = `
      img { -webkit-user-drag: none; user-select: none; }
      .rf-no-select { user-select: none; -webkit-user-select: none; }
    `;
    document.head.appendChild(styleEl);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("dragstart", handleDragStart);
      styleEl.remove();
    };
  }, []);
}
