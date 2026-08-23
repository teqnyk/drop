import { describe, expect, it } from "vitest";
import {
  BOXES,
  EDGES,
  TEXT_INSET,
  TEXT_PADDING,
  WATCHES,
  watchPath,
  type Box,
} from "../app/architecture/page";

/**
 * The architecture diagram's geometry.
 *
 * Two failures have shipped here, both invisible to typecheck, lint and every
 * other test: text that overflowed its box, and an edge that passed through a
 * service it had nothing to do with. Neither is a rendering error — SVG draws
 * both happily. They are only wrong to a reader, so they need measuring.
 */

/**
 * Approximate rendered width.
 *
 * Deliberately generous. Without a browser there is no true measurement, so
 * this errs toward reporting text as WIDER than it renders: a false alarm
 * costs a box resize, a false pass costs a diagram that lies.
 */
function textWidth(text: string, fontSize: number, bold = false): number {
  return text.length * fontSize * (bold ? 0.55 : 0.52);
}

/** The hero box centres its own text and is measured separately. */
const LABELLED = BOXES.filter((b) => b.tone !== "watch");

describe("box text fits its box", () => {
  it.each(LABELLED.map((b) => [b.id, b] as const))("%s", (_id, box: Box) => {
    const available = box.w - TEXT_INSET - TEXT_PADDING;
    // SVG text does not wrap and does not clip. It draws over whatever is
    // beside it, which is how "releases · orders · events" ended up printed
    // across the R2 box.
    expect(textWidth(box.label, 13, true)).toBeLessThanOrEqual(available);
    expect(textWidth(box.sub, 11)).toBeLessThanOrEqual(available);
  });
});

/** Does a segment pass through a rectangle? */
function crosses(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: Box,
): boolean {
  const { x, y, w, h } = box;
  const edges: [number, number, number, number][] = [
    [x, y, x + w, y],
    [x + w, y, x + w, y + h],
    [x + w, y + h, x, y + h],
    [x, y + h, x, y],
  ];
  return edges.some(([x1, y1, x2, y2]) => segmentsIntersect(a, b, { x: x1, y: y1 }, { x: x2, y: y2 }));
}

function segmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): boolean {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t > 0.001 && t < 0.999 && u >= 0 && u <= 1;
}

function centre(b: Box) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function boxOf(id: string): Box {
  const found = BOXES.find((b) => b.id === id);
  if (!found) throw new Error(`Unknown box: ${id}`);
  return found;
}

describe("no edge passes through a box it does not connect", () => {
  it.each(EDGES.map((e) => [`${e.from} → ${e.to}`, e] as const))("%s", (_name, edge) => {
    const from = boxOf(edge.from);
    const to = boxOf(edge.to);
    const a = centre(from);
    const b = centre(to);

    for (const other of BOXES) {
      if (other.id === edge.from || other.id === edge.to) continue;
      // A line crossing an unrelated service asserts a dependency that does
      // not exist — the reader has no way to know the crossing is incidental.
      expect(crosses(a, b, other), `crosses ${other.id}`).toBe(false);
    }
  });
});

describe("no observation passes through a box", () => {
  it.each(WATCHES.map((w) => [w.from, w] as const))("%s → Beaam", (_name, watch) => {
    const from = boxOf(watch.from);
    const points = watchPath(from);

    for (let i = 0; i < points.length - 1; i++) {
      for (const other of BOXES) {
        if (other.id === watch.from || other.id === "beaam") continue;
        expect(
          crosses(points[i], points[i + 1], other),
          `${watch.from} segment ${i} crosses ${other.id}`,
        ).toBe(false);
      }
    }
  });
});

describe("boxes do not overlap each other", () => {
  it("keeps every pair apart", () => {
    for (let i = 0; i < BOXES.length; i++) {
      for (let j = i + 1; j < BOXES.length; j++) {
        const a = BOXES[i];
        const b = BOXES[j];
        const apart =
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
  });
});
