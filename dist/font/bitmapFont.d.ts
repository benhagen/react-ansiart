type BitmapFont = {
    width: number;
    height: number;
    glyphs: Uint8Array[];
    rawBitmapData?: Uint8Array;
    glyphCache?: Map<string, HTMLCanvasElement>;
};
/**
 * Load a raw binary bitmap font (8xN format, 256 glyphs)
 * Expected format: 256 consecutive glyphs, each N bytes (one byte per scanline)
 */
declare function loadRawBitmapFont(url: string, width?: number, height?: number): Promise<BitmapFont>;
declare function renderGlyph(ctx: CanvasRenderingContext2D, font: BitmapFont, charCode: number, x: number, y: number, fgColor: string, bgColor: string): void;
/**
 * Render text string using bitmap font
 */
declare function renderText(ctx: CanvasRenderingContext2D, font: BitmapFont, text: string, x: number, y: number, fgColor: string, bgColor: string): number;

export { type BitmapFont, loadRawBitmapFont, renderGlyph, renderText };
