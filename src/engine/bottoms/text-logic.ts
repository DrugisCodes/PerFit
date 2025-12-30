// Text-based fallback logic for bottoms
import { UserProfile, SizeRecommendation } from '../../stores/types';


/**
 * Calculate recommendation for bottoms based on text measurements (when tables are missing)
 * 
 * Logic:
 * - WAIST ANCHOR: Use userProfile.waist as primary size determinant (NEVER use chest)
 * - INSEAM COMPARISON: Compare product's "Lengde innside ben" with user's inseam
 * - HEIGHT VALIDATION: Use height difference for length warnings
 * - DUAL FIT: If model is 6+ cm taller AND inseam is 3+ cm longer, offer secondary smaller size
 * 
 * @param userProfile - User's body measurements
 * @param textData - Scraped text measurements from product page
 * @returns Size recommendation or null
 */
export function calculateBottomsTextBasedRecommendation(
  userProfile: UserProfile,
  textData: { modelHeight?: number; modelSize: string; itemLength?: number; itemLengthSize?: string; fitHint?: string; inseamLength?: number; stretch?: number }
): SizeRecommendation | null {
  try {
    const userHeight = userProfile.height ? parseInt(userProfile.height) : null;
    const userWaist = userProfile.waist ? parseInt(userProfile.waist) : null;
    const userHip = userProfile.hip ? parseInt(userProfile.hip) : null;
    const userInseam = userProfile.inseam ? parseInt(userProfile.inseam) : null;
    const fitHint = textData.fitHint;
    if (!userWaist) {
      console.error("PerFit [BOTTOM Text]: Cannot proceed - no waist measurement");
      return null;
    }
    const sizeScale = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const modelSizeIndex = sizeScale.indexOf(textData.modelSize.toUpperCase());
    let recommendedIndex = -1;
    let fitNote = '';
    // === STRATEGY 1: WAIST-BASED SIZE ESTIMATION (PRIMARY for bottoms) ===
    if (userWaist < 74) {
      recommendedIndex = sizeScale.indexOf('XS');
    } else if (userWaist < 80) {
      recommendedIndex = sizeScale.indexOf('S');
    } else if (userWaist < 86) {
      recommendedIndex = sizeScale.indexOf('M');
    } else if (userWaist < 94) {
      recommendedIndex = sizeScale.indexOf('L');
    } else if (userWaist < 102) {
      recommendedIndex = sizeScale.indexOf('XL');
    } else if (userWaist < 110) {
      recommendedIndex = sizeScale.indexOf('XXL');
    } else {
      recommendedIndex = sizeScale.indexOf('XXXL');
    }
    // === STRATEGY 2: MODEL SIZE VALIDATION ===
    if (modelSizeIndex !== -1 && textData.modelHeight && userHeight) {
      const heightDiff = userHeight - textData.modelHeight;
      // If user is significantly shorter than model, might need smaller size
      if (heightDiff < -8 && recommendedIndex > modelSizeIndex) {
        // Optionally adjust
      }
    }
    // === STRATEGY 3: FIT HINT ADJUSTMENT ===
    if (fitHint) {
      if (fitHint.toLowerCase().includes('liten') && recommendedIndex < sizeScale.length - 1) {
        recommendedIndex++;
        fitNote = 'Sized up because item runs small';
      } else if (fitHint.toLowerCase().includes('stor') && recommendedIndex > 0) {
        recommendedIndex--;
        fitNote = 'Sized down because item runs large';
      }
    }
    // === STRATEGY 4: INSEAM/LENGTH CHECK ===
    const productInseam = textData.inseamLength || textData.itemLength;
    let inseamDiff = 0;
    if (userInseam && productInseam) {
      inseamDiff = productInseam - userInseam;
      if (inseamDiff < -5) {
        fitNote += (fitNote ? ' • ' : '') + 'May be short in the legs';
      } else if (inseamDiff > 8) {
        fitNote += (fitNote ? ' • ' : '') + 'Long legs, can be hemmed';
      }
    }
    const recommendedSize = sizeScale[recommendedIndex] || 'M';
    // === STRATEGY 5: DUAL FIT RECOMMENDATION FOR HEIGHT DIFFERENCE ===
    const heightDiff = (textData.modelHeight && userHeight) ? textData.modelHeight - userHeight : 0;
    const shouldOfferDualFit = heightDiff >= 6 && inseamDiff > 3 && recommendedIndex > 0;
    if (shouldOfferDualFit) {
      const secondaryIndex = recommendedIndex - 1;
      const secondarySize = sizeScale[secondaryIndex];
      const hasStretch = textData.stretch !== undefined && textData.stretch > 0;
      const heightWarning = `You are ${heightDiff}cm shorter than the model. Size ${recommendedSize} fits your waist, but Size ${secondarySize} might prevent the legs from being too long${hasStretch ? ' if the fabric is stretchy' : ''}.`;
      return {
        size: recommendedSize,
        confidence: 0.75,
        category: 'bottom',
        userChest: userWaist,
        targetChest: userWaist,
        buffer: 0,
        fitNote: 'Best Waist Fit' + (fitNote ? ' • ' + fitNote : ''),
        lengthNote: heightWarning,
        userWaist: userWaist,
        userHip: userHip || undefined,
        userInseam: userInseam || undefined,
        userHeight: userHeight || undefined,
        isDual: true,
        secondarySize: secondarySize,
        secondarySizeNote: 'Shorter Length'
      };
    }
    return {
      size: recommendedSize,
      confidence: 0.7,
      category: 'bottom',
      userChest: userWaist,
      targetChest: userWaist,
      buffer: 0,
      fitNote: fitNote || 'Estimated from waist measurement',
      userWaist: userWaist,
      userHip: userHip || undefined,
      userInseam: userInseam || undefined,
      userHeight: userHeight || undefined
    };
  } catch (error) {
    console.error("PerFit [BOTTOM Text]: Error calculating recommendation:", error);
    return null;
  }
}
