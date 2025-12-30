import { MENS_SHOE_MAPPING } from './constants';
/**
 * Estimate foot length in cm from EU shoe size (men)
 * Uses MENS_SHOE_MAPPING for precise values, falls back to formula if not found.
 * Handles '42.5', '42,5', '42 1/2', etc.
 */
export function estimateFootLengthFromEU(euSizeRaw: string): number | null {
  if (!euSizeRaw) return null;
  // Normalize input: replace comma with dot, trim, handle '1/2' and '½'
  let euSize = euSizeRaw.trim().replace(',', '.');
  // Handle '1/2' or '½' (e.g. '42 1/2', '42½')
  if (/1[\s]?\/?2|½/.test(euSizeRaw)) {
    // Extract base (e.g. '42') and add 0.5
    const base = parseInt(euSize);
    if (!isNaN(base)) euSize = (base + 0.5).toString();
  }
  // Try mapping first
  if (MENS_SHOE_MAPPING[euSize]) {
    return MENS_SHOE_MAPPING[euSize];
  }
  // Fallback: 25.5 + (EU - 40) * 0.5
  const num = parseFloat(euSize);
  if (!isNaN(num)) {
    return Math.round((25.5 + (num - 40) * 0.5) * 10) / 10;
  }
  return null;
}
/**
 * Utility functions for size calculations
 */

/**
 * Convert centimeters to inches (for WxL format)
 * Rounds to nearest whole number
 */
export function cmToInches(cm: number): number {
  return Math.round(cm / 2.54);
}

/**
 * Convert inches to centimeters
 * 1 inch = 2.54 cm
 */
export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54);
}

/**
 * Calculate buffer (extra cm) to add based on fit preference
 * 
 * NOTE: This function is currently COMMENTED OUT per user request.
 * We are using exact measurements without buffer for initial testing.
 * 
 * Fit Preference Scale (1-10):
 * 1-2:   Tight       - Sits completely against skin (0-2cm)
 * 3-4:   Fitted      - Shows body shape, comfortable (3-5cm)
 * 5-6:   Regular Fit - Standard fit, most common (6-9cm)
 * 7-8:   Loose       - Relaxed style, noticeably roomy (10-14cm)
 * 9-10:  Oversized   - Clearly "baggy" style (16-20cm)
 * 
 * Example: User with 105cm chest + Preference 5 (Regular) → 105 + 6 = 111cm target
 * 
 * @param preference - User's fit preference (1-10)
 * @returns Buffer in centimeters to add to measurements
 */
// export function getBufferInCm(preference: number): number {
//   const buffers: Record<number, number> = {
//     1: 0,   // Tight: Sits completely against skin
//     2: 2,   // Tight: Minimal ease
//     3: 3,   // Fitted: Shows body shape
//     4: 5,   // Fitted: Close to body, comfortable
//     5: 6,   // Regular: Standard fit (default)
//     6: 9,   // Regular: Standard comfort
//     7: 10,  // Loose: Relaxed style
//     8: 14,  // Loose: Noticeably roomy
//     9: 16,  // Oversized: Baggy style
//     10: 20  // Oversized: Very baggy
//   };
//   return buffers[preference] || 6; // Default to Regular (6cm)
// }
