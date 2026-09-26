/** One laid-out letter: its glyph, left edge and advance (px), and how far it rises above the baseline. */
export interface Letter { ch: string; x: number; width: number; ascent: number; descent: number }

/**
 * Lay out a line of text letter by letter, keeping the font's kerning, so each letter can move on its
 * own (drop in, bounce, be stood on). `x` is relative to the start of the line.
 */
export function layoutLetters(ctx: CanvasRenderingContext2D, text: string, font: string): Letter[] {
  ctx.save();
  ctx.font = font;
  const out: Letter[] = [];
  for (let i = 0; i < text.length; i++) {
    const x = ctx.measureText(text.slice(0, i)).width;
    const m = ctx.measureText(text[i]);
    out.push({ ch: text[i], x, width: ctx.measureText(text.slice(0, i + 1)).width - x, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent });
  }
  ctx.restore();
  return out;
}

/** Width of a whole line in a font. */
export function textWidth(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
