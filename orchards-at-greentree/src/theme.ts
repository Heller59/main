/**
 * Palette sampled directly from orchardsatgreentree.com:
 *   #527F7A  header / banner teal
 *   #8FB4A2  sage accent from the sign illustration
 *   #E6F2EE  page mint wash
 *   #242424  body ink
 */
export const colors = {
  teal: '#527F7A',
  tealDark: '#3F6863',
  tealDeep: '#2E4F4B',
  sage: '#8FB4A2',
  sageSoft: '#B9D2C5',
  mint: '#E6F2EE',
  mintDeep: '#D4E7E0',
  white: '#FFFFFF',
  ink: '#242424',
  inkSoft: '#5F6E6B',
  inkFaint: '#9BA9A6',
  line: '#DCE9E4',

  // Collection markers
  trash: '#1A1A1A',
  trashSoft: '#F0F0F0',
  recycle: '#39FF14',
  recycleEdge: '#1F8A14',
  recycleSoft: '#E8FFE2',
  bulk: '#8B5E3C',
  bulkDark: '#5A3A23',
  bulkLight: '#A9744F',
  bulkSoft: '#F4EBE3',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
};

export const space = (n: number) => n * 4;

export const typography = {
  display: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  tiny: { fontSize: 11, fontWeight: '600' as const },
};

export const shadow = {
  card: {
    shadowColor: '#2E4F4B',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lift: {
    shadowColor: '#2E4F4B',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
};
