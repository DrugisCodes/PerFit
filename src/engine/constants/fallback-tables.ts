/**
 * Universal fallback size tables based on industry standards (Dale of Norway)
 * Used when websites lack both size tables and model information
 */

export interface FallbackSize {
  size: string;
  chest?: number;
  waist?: number;
  hip?: number;  // Hip measurement for bottoms
}

/**
 * Men's universal size table
 * Based on industry-standard body measurements
 */
export const MENS_UNIVERSAL_FALLBACK: FallbackSize[] = [
  { size: 'XS', waist: 74, hip: 90, chest: 88 },
  { size: 'S', waist: 80, hip: 96, chest: 94 },
  { size: 'M', waist: 86, hip: 102, chest: 100 },
  { size: 'L', waist: 92, hip: 108, chest: 106 },
  { size: 'XL', waist: 98, hip: 114, chest: 112 }
];

/**
 * Women's universal size table
 * Based on industry-standard body measurements
 */
export const WOMENS_UNIVERSAL_FALLBACK: FallbackSize[] = [
  { size: 'XS', waist: 64, hip: 88, chest: 80 },
  { size: 'S', waist: 68, hip: 92, chest: 84 },
  { size: 'M', waist: 74, hip: 98, chest: 90 },
  { size: 'L', waist: 80, hip: 104, chest: 96 }
];
