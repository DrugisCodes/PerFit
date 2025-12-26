/**
 * PerFit Content Script - Analysis Module
 * 
 * Handles length/height analysis between user and model.
 */

import { UserProfile } from '../stores/types';

/**
 * Analyze length/height fit between user and model
 * 
 * Compares user's height against model's height to detect significant mismatches.
 * Returns a warning message if the garment may be too long or too short.
 * 
 * @param userProfile - User's body measurements including height
 * @param textData - Scraped text measurements from product page (model info)
 * @param recommendedSize - The recommended size (for future size-based length adjustments)
 * @returns Warning message string or null if no significant mismatch
 */
export function analyzeLengthFit(
  userProfile: UserProfile,
  textData: any,
  _recommendedSize: string // Reserved for future size-based length adjustments
): string | null {
  // Guard: Need both user height and model height
  if (!userProfile.height || !textData || !textData.modelHeight) {
    console.log("PerFit [Length Analysis]: Missing height data - skipping analysis");
    return null;
  }

  // ROBUST CASTING: Handle both string ("177") and number (177) inputs
  const userHeight = Number(userProfile.height);
  const modelHeight = Number(textData.modelHeight);
  
  // Validate parsed values
  if (isNaN(userHeight) || isNaN(modelHeight) || userHeight <= 0 || modelHeight <= 0) {
    console.warn("PerFit [Length Analysis]: Invalid height values:", {
      userHeight: userProfile.height,
      modelHeight: textData.modelHeight
    });
    return null;
  }

  // Calculate height difference (positive = model is taller)
  const heightDiff = modelHeight - userHeight;
  
  console.log(`PerFit [Length Analysis]: User ${userHeight}cm vs Model ${modelHeight}cm (diff: ${heightDiff > 0 ? '+' : ''}${heightDiff}cm)`);

  // LOWERED THRESHOLD: Model is significantly taller (> 6cm)
  if (heightDiff > 6) {
    const warning = `⚠️ Modellen er ${heightDiff} cm høyere enn deg. Selv om vidden passer, kan plagget føles lenger på deg.`;
    console.log("PerFit [Length Analysis]: ⚠️ WARNING triggered:", warning);
    return warning;
  }

  // LOWERED THRESHOLD: User is significantly taller (> 6cm)
  if (heightDiff < -6) {
    const userTaller = Math.abs(heightDiff);
    const warning = `⚠️ Du er ${userTaller} cm høyere enn modellen. Plagget kan oppleves kortere på deg.`;
    console.log("PerFit [Length Analysis]: ⚠️ WARNING triggered:", warning);
    return warning;
  }

  // No significant height difference
  console.log("PerFit [Length Analysis]: ✅ Height difference within acceptable range (±6cm)");
  return null;
}
