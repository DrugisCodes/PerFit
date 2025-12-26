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
