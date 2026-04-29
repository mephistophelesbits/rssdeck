import React from 'react';

/**
 * IntelliDeck Origami North Star Mark
 *
 * A 4-pointed compass star built from 12 triangular origami facets,
 * with a smaller 45°-rotated inner star at the center.
 * Light source is top-left — shading runs from #FFA040 (lit) to #B84400 (deep shadow).
 *
 * Usage:
 *   <IntelliDeckMark size={48} />
 *   <IntelliDeckMark size={32} variant="reversed" />   // white star on dark bg
 *   <IntelliDeckMark size={24} variant="monochrome" /> // single flat color
 */

type Variant = 'color' | 'reversed' | 'monochrome';

interface IntelliDeckMarkProps {
  /** Pixel size (width = height). Default: 48 */
  size?: number;
  /** Color variant. Default: 'color' */
  variant?: Variant;
  className?: string;
  style?: React.CSSProperties;
}

// ── Brand color tokens ────────────────────────────────────────────────────────
const COLORS = {
  navy:    '#001426',
  orange:  '#FF6A00',

  // Origami facet shading (light source: top-left)
  facet: {
    litTop:     '#FFA040',  // top-left point — most lit
    litLeft:    '#FF8C30',  // left point — partially lit
    midTopR:    '#FF6A00',  // top-right face
    midRightT:  '#FF7820',  // right point top
    innerTopL:  '#FF9030',  // inner center top-left
    innerLeft:  '#FF8030',  // inner center left
    shadowRightB: '#CC4E00', // right point bottom
    shadowLeft:   '#E06200', // left point bottom
    innerRight:   '#D96000', // inner center right
    shadowBotL:   '#D55800', // bottom-left outer
    darkBotR:     '#B84400', // bottom-right — deepest shadow
    innerBot:     '#B84400', // inner center bottom
  },
} as const;

// Crease line colors
const CREASE_OUTER  = 'rgba(0,0,0,0.13)';
const CREASE_RIDGE_LIGHT = 'rgba(255,255,255,0.25)';
const CREASE_RIDGE_DARK  = 'rgba(0,0,0,0.15)';
const CREASE_CENTER = 'rgba(0,0,0,0.18)';

export function IntelliDeckMark({
  size = 48,
  variant = 'color',
  className,
  style,
}: IntelliDeckMarkProps) {
  const f = COLORS.facet;

  // Monochrome uses single flat orange; reversed uses white facets on dark bg
  const facetColor = (color: string) => {
    if (variant === 'monochrome') return COLORS.orange;
    if (variant === 'reversed')   return `white`;
    return color;
  };

  const innerStarFill   = variant === 'monochrome' ? 'white'
                        : variant === 'reversed'   ? COLORS.navy
                        : 'white';
  const showCreases = variant === 'color';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="IntelliDeck"
      role="img"
    >
      {/* ── OUTER POINT FACES (8 triangles) ─────────────────────────────── */}
      {/* Top point */}
      <polygon points="37,37 50,5 50,37"  fill={facetColor(f.litTop)} />
      <polygon points="50,37 50,5 63,37"  fill={facetColor(f.midTopR)} />
      {/* Right point */}
      <polygon points="63,37 95,50 63,50" fill={facetColor(f.midRightT)} />
      <polygon points="63,50 95,50 63,63" fill={facetColor(f.shadowRightB)} />
      {/* Bottom point */}
      <polygon points="63,63 50,95 50,63" fill={facetColor(f.darkBotR)} />
      <polygon points="50,63 50,95 37,63" fill={facetColor(f.shadowBotL)} />
      {/* Left point */}
      <polygon points="37,63 5,50 37,50"  fill={facetColor(f.shadowLeft)} />
      <polygon points="37,50 5,50 37,37"  fill={facetColor(f.litLeft)} />

      {/* ── INNER CENTER FACES (4 triangles meeting at 50,50) ─────────────  */}
      <polygon points="37,37 63,37 50,50" fill={facetColor(f.innerTopL)} />
      <polygon points="63,37 63,63 50,50" fill={facetColor(f.innerRight)} />
      <polygon points="63,63 37,63 50,50" fill={facetColor(f.innerBot)} />
      <polygon points="37,63 37,37 50,50" fill={facetColor(f.innerLeft)} />

      {/* ── FOLD / CREASE LINES ─────────────────────────────────────────── */}
      {showCreases && (
        <>
          {/* Outer square edges */}
          <line x1="37" y1="37" x2="63" y2="37" stroke={CREASE_OUTER}       strokeWidth="0.6" />
          <line x1="63" y1="37" x2="63" y2="63" stroke={CREASE_OUTER}       strokeWidth="0.6" />
          <line x1="63" y1="63" x2="37" y2="63" stroke={CREASE_OUTER}       strokeWidth="0.6" />
          <line x1="37" y1="63" x2="37" y2="37" stroke={CREASE_OUTER}       strokeWidth="0.6" />
          {/* Tip ridges */}
          <line x1="50" y1="5"  x2="50" y2="37" stroke={CREASE_RIDGE_LIGHT} strokeWidth="0.5" />
          <line x1="95" y1="50" x2="63" y2="50" stroke={CREASE_RIDGE_DARK}  strokeWidth="0.5" />
          <line x1="50" y1="95" x2="50" y2="63" stroke={CREASE_RIDGE_DARK}  strokeWidth="0.5" />
          <line x1="5"  y1="50" x2="37" y2="50" stroke={CREASE_RIDGE_LIGHT} strokeWidth="0.5" />
          {/* Center diagonals */}
          <line x1="50" y1="50" x2="37" y2="37" stroke={CREASE_CENTER} strokeWidth="0.6" />
          <line x1="50" y1="50" x2="63" y2="37" stroke={CREASE_CENTER} strokeWidth="0.6" />
          <line x1="50" y1="50" x2="63" y2="63" stroke={CREASE_CENTER} strokeWidth="0.6" />
          <line x1="50" y1="50" x2="37" y2="63" stroke={CREASE_CENTER} strokeWidth="0.6" />
        </>
      )}

      {/* ── INNER STAR (4-point, rotated 45°) ───────────────────────────── */}
      {/*    Outer radius ~11, inner radius ~4.5, centered at (50,50)        */}
      <path
        d="M58,42 L54.5,50 L58,58 L50,54.5 L42,58 L45.5,50 L42,42 L50,45.5 Z"
        fill={innerStarFill}
        fillOpacity={0.95}
      />
    </svg>
  );
}

export default IntelliDeckMark;
