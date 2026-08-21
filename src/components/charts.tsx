import { useState, type ReactNode } from 'react';
import type { Slice } from '../lib/stats';

/**
 * Single-measure charts use one hue — colour is not carrying identity here, the
 * category labels are. Each hue is a token rather than a hex because it is
 * stepped per theme: dark #d63755 / #c98500 on the dark card, light #bf2745 /
 * #b07d10 on the light one, both sets validated for lightness band, chroma,
 * colour-vision separation and 3:1 contrast against their own surface.
 */
export const COUNT_HUE = 'var(--chart-count)';
export const RATING_HUE = 'var(--chart-rating)';

export const Tile = ({ value, label }: { value: ReactNode; label: string }) => (
  <div className="tile">
    <div className="value">{value}</div>
    <div className="label">{label}</div>
  </div>
);

export const ChartCard = ({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) => (
  <div className="chart-card">
    <h3>{title}</h3>
    {note ? <p className="chart-note">{note}</p> : null}
    {children}
  </div>
);

interface RankedBarsProps {
  data: Slice[];
  hue?: string;
  /** Formats the value shown at the end of each row. */
  format?: (value: number) => string;
  /** Fixed scale maximum — use for ratings so bars are comparable across charts. */
  scaleMax?: number;
}

/**
 * Horizontal ranked bars. Every value is written next to its bar, so the chart
 * is its own table view and nothing is locked behind a hover.
 */
export const RankedBars = ({
  data,
  hue = COUNT_HUE,
  format = (value) => String(value),
  scaleMax,
}: RankedBarsProps) => {
  const max = scaleMax ?? Math.max(...data.map((slice) => slice.value), 1);
  return (
    <div className="bar-list" style={{ paddingBottom: 10 }}>
      {data.map((slice) => (
        <div className="bar-row" key={slice.label}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {slice.label}
            {slice.detail ? <span className="faint tiny"> · {slice.detail}</span> : null}
          </span>
          <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {format(slice.value)}
          </span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{
                // Zero stays empty; anything non-zero keeps a visible sliver.
                width: slice.value === 0 ? 0 : `${Math.max(2, (slice.value / max) * 100)}%`,
                background: hue,
              }}
            />
          </span>
        </div>
      ))}
    </div>
  );
};

/** Path for a bar with rounded top corners, anchored square to the baseline. */
const barPath = (x: number, y: number, width: number, height: number, radius: number) => {
  const r = Math.min(radius, width / 2, height);
  return [
    `M${x} ${y + height}`,
    `V${y + r}`,
    `a${r} ${r} 0 0 1 ${r} ${-r}`,
    `h${width - 2 * r}`,
    `a${r} ${r} 0 0 1 ${r} ${r}`,
    `V${y + height}`,
    'Z',
  ].join(' ');
};

interface ColumnChartProps {
  data: Slice[];
  hue?: string;
  /** Axis caption under the chart. */
  unit?: string;
}

/**
 * Vertical bars for ordered series (months, vintages). The peak is always
 * labelled; tapping any column labels that one, so values never live in a
 * hover-only layer.
 */
export const ColumnChart = ({ data, hue = COUNT_HUE, unit = 'bottles' }: ColumnChartProps) => {
  const [focus, setFocus] = useState<number | null>(null);

  const width = 360;
  const height = 168;
  const padTop = 18;
  const padBottom = 26;
  const plot = height - padTop - padBottom;

  const max = Math.max(...data.map((slice) => slice.value), 1);
  const step = width / Math.max(data.length, 1);
  const barWidth = Math.max(3, step - 2); // 2 units of surface gap between bars
  const peak = data.reduce(
    (best, slice, index) => (slice.value > (data[best]?.value ?? -1) ? index : best),
    0,
  );

  // With many columns only the ends and the peak get a tick label, so they never collide.
  const dense = data.length > 12;
  const showTick = (index: number) =>
    !dense || index === 0 || index === data.length - 1 || index === peak;

  const active = focus ?? peak;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'manipulation' }}
        role="img"
        aria-label={`${unit} per ${data.length} periods`}
      >
        <line
          x1="0"
          x2={width}
          y1={padTop}
          y2={padTop}
          stroke="var(--line)"
          strokeWidth="1"
          shapeRendering="crispEdges"
        />
        <line
          x1="0"
          x2={width}
          y1={height - padBottom}
          y2={height - padBottom}
          stroke="var(--line-strong)"
          strokeWidth="1"
          shapeRendering="crispEdges"
        />

        {data.map((slice, index) => {
          const barHeight = (slice.value / max) * plot;
          const x = index * step + (step - barWidth) / 2;
          const y = height - padBottom - barHeight;
          const isActive = index === active && slice.value > 0;
          return (
            <g key={`${slice.label}-${index}`}>
              {/* Full-height hit area keeps the tap target comfortably large. */}
              <rect
                x={index * step}
                y={0}
                width={step}
                height={height}
                fill="transparent"
                onPointerDown={() => setFocus(index === focus ? null : index)}
              />
              {slice.value > 0 ? (
                <path
                  d={barPath(x, y, barWidth, barHeight, 4)}
                  fill={hue}
                  opacity={focus === null || focus === index ? 1 : 0.45}
                  pointerEvents="none"
                />
              ) : null}
              {isActive ? (
                <text
                  x={index * step + step / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--text)"
                  pointerEvents="none"
                >
                  {slice.value}
                </text>
              ) : null}
              {showTick(index) ? (
                <text
                  x={index * step + step / 2}
                  y={height - padBottom + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--text-faint)"
                  pointerEvents="none"
                >
                  {slice.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="tiny faint" style={{ padding: '2px 2px 10px' }}>
        {data[active]
          ? `${data[active].label}${data[active].detail && data[active].detail !== data[active].label ? ` ${data[active].detail}` : ''}: ${data[active].value} ${unit}`
          : `No ${unit} yet`}
        {' · tap a column for its total'}
      </div>
    </div>
  );
};
