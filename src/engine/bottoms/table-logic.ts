// Table-based (S/M/L/EU) logic for bottoms
import { SizeRow, UserProfile, SizeRecommendation } from '../../stores/types';


/**
 * Table-based (S/M/L/EU) logic for bottoms
 * Standard table-matching (waist >= userWaist && hip >= userHip)
 */
export function calculateTableRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  textData?: {
    isAnkleLength?: boolean;
    lengthType?: string;
    stretch?: number;
    modelHeight?: number;
    inseamLength?: number;
    inseamLengthSize?: string;
  },
  fitHint?: string
): SizeRecommendation | null {
  let userWaist = parseInt(userProfile.waist);
  let userHip = parseInt(userProfile.hip);
  const userInseam = userProfile.inseam ? parseInt(userProfile.inseam) : null;
  // const userHeight = userProfile.height ? parseInt(userProfile.height) : null;
  if (isNaN(userWaist) || userWaist <= 0) {
    console.error("PerFit: Invalid waist measurement:", userProfile.waist);
    return null;
  }
  if (isNaN(userHip) || userHip <= 0) {
    console.error("PerFit: Invalid hip measurement:", userProfile.hip);
    return null;
  }

  // Inseam anchor note (for fitNote)
  const productInseam = textData?.inseamLength;
  const productInseamSize = textData?.inseamLengthSize;
  let inseamAnchorNote = '';
  if (productInseam && userInseam) {
    const inseamDiff = Math.abs(productInseam - userInseam);
    if (inseamDiff <= 1.5 && productInseamSize) {
      const lockedLength = productInseamSize.match(/L(\d{2})$/i)?.[1] || productInseamSize.split('X')[1] || productInseamSize.split('/')[1] || productInseamSize.split(' ')[1];
      inseamAnchorNote = `Size ${lockedLength} is a confirmed ${productInseam}cm match for your legs based on product details`;
    } else if (inseamDiff <= 3) {
      inseamAnchorNote = `Your inseam: ${userInseam}cm • Item inseam: ${productInseam}cm → Good fit`;
    } else if (productInseam > userInseam) {
      inseamAnchorNote = `Your inseam: ${userInseam}cm • Item inseam: ${productInseam}cm → May need hemming`;
    } else {
      inseamAnchorNote = `Your inseam: ${userInseam}cm • Item inseam: ${productInseam}cm → May be short`;
    }
  }

  // Fit hint adjustment
  let sizeAdjustmentNote = '';
  const originalWaist = userWaist;
  if (fitHint?.toLowerCase().includes('liten')) {
    userWaist += 2;
    userHip += 2;
    sizeAdjustmentNote = 'Sized up because item runs small';
  } else if (fitHint?.toLowerCase().includes('stor')) {
    userWaist -= 2;
    userHip -= 2;
    sizeAdjustmentNote = 'Sized down because item runs large';
  }

  // Table-matching logic
  for (const size of sizeData) {
    const waistFits = size.waist >= userWaist;
    const hipFits = size.hip >= userHip;
    if (waistFits && hipFits) {
      let fitNote = '';
      if (inseamAnchorNote) {
        fitNote = inseamAnchorNote;
      } else if (userInseam && size.inseam) {
        const diff = size.inseam - userInseam;
        if (textData?.isAnkleLength) {
          fitNote = 'Designed to end at the ankle';
        } else if (diff < -3) {
          fitNote = 'May be slightly short in the legs';
        } else if (diff > 5) {
          fitNote = 'Pants are long, can be hemmed';
        }
      }
      if (textData?.stretch === 0 && size.waist === userWaist) {
        fitNote += ' (No stretch - may feel tight)';
      }
      if (sizeAdjustmentNote) {
        fitNote = sizeAdjustmentNote + (fitNote ? ' • ' + fitNote : '');
      }
      return {
        size: size.intSize,
        confidence: 1.0,
        category: 'bottom',
        userChest: originalWaist,
        targetChest: size.waist,
        buffer: 0,
        matchedRow: size,
        fitNote: fitNote.trim(),
        userWaist: originalWaist,
        userHip: parseInt(userProfile.hip),
        userInseam: userInseam || undefined,
        userHeight: userProfile.height ? parseInt(userProfile.height) : undefined,
        inseamLength: productInseam,
        inseamLengthSize: productInseamSize
      };
    }
  }
  return null;
}
