import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { PdfSelection } from "../types/selection";
import { orderSelectionText } from "../utils/orderSelectionText";
import type { SelectionFragment } from "../utils/orderSelectionText";
import { normalizePdfSelection } from "../utils/normalizePdfSelection";
import { extractSelectionContext } from "../utils/extractSelectionContext";
import type { ContextFragment } from "../utils/extractSelectionContext";

function textLayerFor(node: Node | null): Element | null {
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest(".textLayer") ?? null;
}

/** Read only ranges whose two endpoints belong to this viewer's same text layer. */
export function readPdfSelection(root: HTMLElement): PdfSelection | null {
  const selected = window.getSelection();
  if (!selected || selected.isCollapsed || selected.rangeCount !== 1) return null;
  const startLayer = textLayerFor(selected.anchorNode);
  const endLayer = textLayerFor(selected.focusNode);
  if (!startLayer || startLayer !== endLayer || !root.contains(startLayer)) return null;
  const page = startLayer.closest<HTMLElement>("[data-page-number]");
  const pageNumber = Number(page?.dataset.pageNumber);
  if (!page || !root.contains(page) || !Number.isInteger(pageNumber) || pageNumber < 1) return null;
  const range = selected.getRangeAt(0);
  if (!startLayer.contains(range.commonAncestorContainer)) return null;
  const rawText = selected.toString();
  if (!rawText.trim()) return null;
  // Element rects can include PDF.js's full-page endOfContent selection guard.
  // Measure selected text-node fragments only, not their layout containers.
  const rects: DOMRect[] = [];
  const fragments: SelectionFragment[] = [];
  const before: ContextFragment[] = [];
  const after: ContextFragment[] = [];
  const selectedColumns: { left: number; right: number }[] = [];
  const walker = document.createTreeWalker(startLayer, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.length) {
      const whole = document.createRange();
      whole.selectNodeContents(node);
      const bounds = whole.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        const start = range.startContainer === node ? range.startOffset : 0;
        const end = range.endContainer === node ? range.endOffset : node.textContent.length;
        const item = (text: string) => ({ text, left: bounds.left, right: bounds.right });
        if (range.intersectsNode(node)) {
          selectedColumns.push(bounds);
          if (start) before.push(item(node.textContent.slice(0, start)));
          if (end < node.textContent.length) after.push(item(node.textContent.slice(end)));
        } else if (range.comparePoint(node, 0) < 0) before.push(item(node.textContent));
        else after.push(item(node.textContent));
      }
    }
    if (node.textContent?.length && range.intersectsNode(node)) {
      const fragment = document.createRange();
      fragment.setStart(node, range.startContainer === node ? range.startOffset : 0);
      fragment.setEnd(node, range.endContainer === node ? range.endOffset : node.textContent.length);
      const bounds = fragment.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        fragments.push({ text: fragment.toString(), left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom });
      }
      for (const rect of Array.from(fragment.getClientRects())) {
        if (rect.width > 0 && rect.height > 0) rects.push(DOMRect.fromRect(rect));
      }
    }
    node = walker.nextNode();
  }
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const text = orderSelectionText(fragments, rawText);
  const column = {
    left: Math.min(...selectedColumns.map((item) => item.left)),
    right: Math.max(...selectedColumns.map((item) => item.right)),
  };
  return { text, rawText, cleanedText: normalizePdfSelection(text),
    context: extractSelectionContext(before, after, column),
    pageNumber, rect: new DOMRect(left, top, right - left, bottom - top), rects };
}

export function usePdfSelection(rootRef: RefObject<HTMLElement | null>, scopeKey: string) {
  const [snapshot, setSnapshot] = useState<{ scopeKey: string; value: PdfSelection | null } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame: number | null = null;
    const controller = new AbortController();
    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setSnapshot({ scopeKey, value: readPdfSelection(root) });
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-selection-controls]")) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        setSnapshot({ scopeKey, value: null });
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "a") return;
      // Only override Select All while focus is inside this viewer's PDF text.
      const target = event.target instanceof Node ? textLayerFor(event.target) : null;
      if (!target || !root.contains(target)) return;
      const selected = window.getSelection();
      if (!selected) return;
      event.preventDefault();
      const range = document.createRange();
      range.selectNodeContents(target);
      selected.removeAllRanges();
      selected.addRange(range);
      schedule();
    };
    const options = { signal: controller.signal };
    document.addEventListener("selectionchange", schedule, options);
    document.addEventListener("pointerup", schedule, options);
    document.addEventListener("keyup", schedule, options);
    root.addEventListener("keydown", onKeyDown, options);
    document.addEventListener("pointerdown", onPointerDown, options);
    document.addEventListener("scroll", schedule, { ...options, capture: true, passive: true });
    window.addEventListener("resize", schedule, options);
    // Layout changes can resize the PDF viewport without a window resize.
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    return () => {
      observer.disconnect();
      controller.abort();
      if (frame !== null) cancelAnimationFrame(frame);
      const selected = window.getSelection();
      // Discard only this viewer's old highlight when page, file or zoom changes.
      if (selected?.anchorNode && root.contains(selected.anchorNode)) selected.removeAllRanges();
    };
  }, [rootRef, scopeKey]);

  // A stale snapshot never leaks into a different page/document/zoom render.
  return snapshot?.scopeKey === scopeKey ? snapshot.value : null;
}

