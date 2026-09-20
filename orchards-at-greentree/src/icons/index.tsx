import React from 'react';
import Svg, { Path, Rect, G, Circle, Line } from 'react-native-svg';
import { colors } from '../theme';

type IconProps = { size?: number };

/* ------------------------------------------------------------------ */
/* Trash — a small black bin with a lid and knocked-out ribs           */
/* ------------------------------------------------------------------ */
export function TrashIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* lid handle */}
      <Rect x={40} y={5} width={20} height={8} rx={3.5} fill={colors.trash} />
      {/* lid */}
      <Rect x={13} y={16} width={74} height={13} rx={5.5} fill={colors.trash} />
      {/* tapered body */}
      <Path
        d="M22 33 H78 L71.5 88 Q70.8 94 64.8 94 H35.2 Q29.2 94 28.5 88 Z"
        fill={colors.trash}
      />
      {/* ribs */}
      <Rect x={36.5} y={45} width={5} height={36} rx={2.5} fill={colors.white} opacity={0.9} />
      <Rect x={47.5} y={45} width={5} height={36} rx={2.5} fill={colors.white} opacity={0.9} />
      <Rect x={58.5} y={45} width={5} height={36} rx={2.5} fill={colors.white} opacity={0.9} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Recycling — three blue chasing arrows in a Mobius triangle.    */
/* One arm is drawn once and rotated 120 degrees twice; the head of     */
/* each arm lands exactly where the next arm begins.                    */
/* ------------------------------------------------------------------ */
export function RecycleIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {[0, 120, 240].map((angle) => (
        <G key={angle} rotation={angle} origin="50, 50">
          {/* band along one edge of the triangle */}
          <Path
            d="M28.5 62.5 L43 37.5"
            stroke={colors.recycle}
            strokeWidth={11}
            strokeLinecap="round"
            fill="none"
          />
          {/* arrow head */}
          <Path d="M48.9 27.05 L48.66 40.7 L37.34 34.3 Z" fill={colors.recycle} />
        </G>
      ))}
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Bulk — a brown, well-worn couch: patched back, split seat, a tear    */
/* ------------------------------------------------------------------ */
export function CouchIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* backrest */}
      <Rect x={12} y={24} width={76} height={32} rx={9} fill={colors.bulk} />
      {/* worn patch, lighter where the nap has rubbed away */}
      <Rect x={29} y={32} width={16} height={10} rx={3.5} fill={colors.bulkLight} opacity={0.8} />
      {/* arms */}
      <Rect x={5} y={43} width={17} height={32} rx={7.5} fill={colors.bulkDark} />
      <Rect x={78} y={43} width={17} height={32} rx={7.5} fill={colors.bulkDark} />
      {/* seat */}
      <Rect x={18} y={52} width={64} height={23} rx={6.5} fill={colors.bulkLight} />
      {/* cushion split */}
      <Line x1={50} y1={55} x2={50} y2={73} stroke={colors.bulkDark} strokeWidth={2.4} />
      {/* threadbare tear, stitched */}
      <Path
        d="M26 64 l4.5 -4 3.5 4.5 4.5 -4"
        stroke={colors.bulkDark}
        strokeWidth={2.4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* sagging spring poking through */}
      <Circle cx={68} cy={63} r={2.6} fill={colors.bulkDark} opacity={0.65} />
      {/* legs */}
      <Rect x={11} y={75} width={8} height={10} rx={2.5} fill={colors.bulkDark} />
      <Rect x={81} y={75} width={8} height={10} rx={2.5} fill={colors.bulkDark} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* UI glyphs                                                           */
/* ------------------------------------------------------------------ */
export function BellIcon({ size = 22, color = colors.white, active = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3a6 6 0 0 0-6 6v3.6L4.4 15.2A1 1 0 0 0 5.3 16.7h13.4a1 1 0 0 0 .9-1.5L18 12.6V9a6 6 0 0 0-6-6z"
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="M10 19.2a2.2 2.2 0 0 0 4 0"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
      {active ? <Circle cx={18.6} cy={5.6} r={3.1} fill="#E23D3D" stroke={color} strokeWidth={1.3} /> : null}
    </Svg>
  );
}

export function GearIcon({ size = 22, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"
        stroke={color}
        strokeWidth={1.7}
        fill="none"
      />
      <Path
        d="M19.1 14a1.5 1.5 0 0 0 .3 1.65l.05.05a1.8 1.8 0 1 1-2.55 2.55l-.05-.05a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.91 1.37V20a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.05.05a1.8 1.8 0 1 1-2.55-2.55l.05-.05a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.91H4a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.05-.05A1.8 1.8 0 1 1 7.67 4.88l.05.05a1.5 1.5 0 0 0 1.65.3H9.4a1.5 1.5 0 0 0 .91-1.37V4a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 .91 1.37 1.5 1.5 0 0 0 1.65-.3l.05-.05a1.8 1.8 0 1 1 2.55 2.55l-.05.05a1.5 1.5 0 0 0-.3 1.65v.06a1.5 1.5 0 0 0 1.37.91H20a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.37.91z"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronIcon({ size = 22, color = colors.teal, direction = 'left' as 'left' | 'right' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={direction === 'left' ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19'}
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = colors.inkSoft }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 6 L18 18 M18 6 L6 18"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Small tree mark echoing the Orchards logo, used in the header. */
export function TreeMark({ size = 30, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M50 88 L50 52"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <Path
        d="M50 62 L31 44 M50 56 L69 38 M50 72 L36 62"
        stroke={color}
        strokeWidth={4.5}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={28} cy={40} r={9} fill={color} />
      <Circle cx={46} cy={28} r={11} fill={color} />
      <Circle cx={66} cy={34} r={10} fill={color} />
      <Circle cx={72} cy={52} r={7.5} fill={color} />
      <Circle cx={33} cy={58} r={7} fill={color} />
      <Rect x={36} y={86} width={28} height={6} rx={3} fill={color} />
    </Svg>
  );
}

export const KindIcon: Record<string, React.ComponentType<IconProps>> = {
  trash: TrashIcon,
  recycling: RecycleIcon,
  bulk: CouchIcon,
};
