// WxL (jeans/tomme-størrelser) logic for bottoms
// Handles dropdownSizes with WxL-format, lockedLength (Inseam Anchor), and MENS_JEANS_WAIST_MAPPING

import { SizeRow, UserProfile, SizeRecommendation } from '../../stores/types';
import { cmToInches } from '../utils';
import { MENS_JEANS_WAIST_MAPPING } from '../constants';


/**
 * WxL (jeans/tomme-størrelser) logic for bottoms
 * Handles dropdownSizes with WxL-format, lockedLength (Inseam Anchor), and MENS_JEANS_WAIST_MAPPING
 * Includes 'Ease Factor' (+2 cm on inseam) and inseam anchor logic
 */
export function calculateWxLRecommendation(
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
  dropdownSizes?: string[],
  fitHint?: string
): SizeRecommendation | null {
  let userWaist = parseInt(userProfile.waist);
  let userHip = parseInt(userProfile.hip);
  const userInseam = userProfile.inseam ? parseInt(userProfile.inseam) : null;
  const userHeight = userProfile.height ? parseInt(userProfile.height) : null;

  if (isNaN(userWaist) || userWaist <= 0) {
    console.error("PerFit: Invalid waist measurement:", userProfile.waist);
    return null;
  }
  if (isNaN(userHip) || userHip <= 0) {
    console.error("PerFit: Invalid hip measurement:", userProfile.hip);
    return null;
  }

  // === INSEAM ANCHOR: Extract product inseam info if available ===
  const productInseam = textData?.inseamLength;
  const productInseamSize = textData?.inseamLengthSize;
  let inseamAnchorNote = '';
  let lockedLength = null;
  if (productInseam && userInseam) {
    const inseamDiff = Math.abs(productInseam - userInseam);
    if (inseamDiff <= 1.5 && productInseamSize) {
      lockedLength = productInseamSize.match(/L(\d{2})$/i)?.[1] || productInseamSize.split('X')[1] || productInseamSize.split('/')[1] || productInseamSize.split(' ')[1];
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

  const modelHeight = textData?.modelHeight;
  const heightDiff = (modelHeight && userHeight) ? modelHeight - userHeight : 0;

  // WxL-format logic
  if (dropdownSizes && dropdownSizes.length > 0 && userInseam) {
    const wxlRegex = /(?:W)?\s*(\d+)\s*[x×X/\-\s]+(?:L)?\s*(\d+)/i;
    const hasWxL = dropdownSizes.some(s => wxlRegex.test(s));
    let isPerfectAnchorMatch = false;
    if (productInseam && userInseam && Math.abs(productInseam - userInseam) <= 0.5) {
      isPerfectAnchorMatch = true;
    }
    if (hasWxL) {
      // --- EASE FACTOR: Add 2 cm to userInseam before converting to inches ---
      const easeInseam = userInseam + 2;
      const targetW = cmToInches(userWaist);
      const targetL = cmToInches(easeInseam);

      // If anchor matches perfectly, only lock the LENGTH (L32), but always calculate user's W-size
      if (isPerfectAnchorMatch && lockedLength) {
        // 1. Calculate user's W-size (from waist)
        let targetW = null;
        // Try to find the closest W in MENS_JEANS_WAIST_MAPPING
        let minDiff = Infinity;
        let bestW = null;
        Object.entries(MENS_JEANS_WAIST_MAPPING).forEach(([wStr, wCm]) => {
          const diff = Math.abs(Number(wCm) - userWaist);
          if (diff < minDiff) {
            minDiff = diff;
            bestW = Number(wStr);
          }
        });
        // If not found, fallback to inches
        if (!bestW) {
          bestW = Math.round(userWaist / 2.54);
        }
        targetW = bestW;

        // 2. Find all dropdown sizes with locked length (L32)
        const anchorSizes = dropdownSizes.filter(s => {
          const match = s.match(wxlRegex);
          return match && match[2] === lockedLength;
        });

        // 3. Among these, find the one with W closest to targetW
        let bestAnchor = '';
        let bestWdiff = Infinity;
        let matchedRow: SizeRow | undefined = undefined;
        anchorSizes.forEach(s => {
          const match = s.match(wxlRegex);
          if (match) {
            const w = parseInt(match[1]);
            const wCm = MENS_JEANS_WAIST_MAPPING[w] || Math.round(w * 2.54);
            const diff = Math.abs(w - targetW);
            if (diff < bestWdiff) {
              bestWdiff = diff;
              bestAnchor = s;
              // Find closest row in sizeData to this wCm
              let minRowDiff = Infinity;
              sizeData.forEach(row => {
                const rowDiff = Math.abs(row.waist - wCm);
                if (rowDiff < minRowDiff) {
                  minRowDiff = rowDiff;
                  matchedRow = row;
                }
              });
            }
          }
        });

        if (bestAnchor && matchedRow) {
          let modelMsg = '';
          if (textData?.modelHeight && productInseam) {
            modelMsg = `Model is ${textData.modelHeight}cm. Both of you have a ${productInseam}cm inseam, so L${lockedLength} is your perfect length. Size W${targetW} is calculated to fit your ${userWaist}cm waist`;
          }
          return {
            size: bestAnchor,
            confidence: 1.0,
            category: 'bottom',
            userChest: originalWaist,
            targetChest: userWaist,
            buffer: 0,
            fitNote: modelMsg,
            userWaist: originalWaist,
            userHip: parseInt(userProfile.hip),
            userInseam: userInseam || undefined,
            userHeight: userHeight || undefined,
            matchedRow,
            inseamLength: productInseam,
            inseamLengthSize: productInseamSize
          };
        }
      }

      // === INSEAM ANCHOR LOCK: If lockedLength is set, prioritize it and ignore shorter lengths ===
      if (lockedLength) {
        const anchorSizes = dropdownSizes.filter(s => {
          const match = s.match(wxlRegex);
          return match && match[2] === lockedLength;
        });
        const sizesToSearch = anchorSizes.filter(s => s.toLowerCase().endsWith('x' + lockedLength));
        let bestAnchor = '';
        let bestWaistDiff = Infinity;
        let matchedRow = undefined;
        sizesToSearch.forEach(s => {
          const match = s.match(wxlRegex);
          if (match) {
            const w = parseInt(match[1]);
            let wCm = MENS_JEANS_WAIST_MAPPING[w] || Math.round(w * 2.54);
            let minDiff = Infinity;
            let bestRow = undefined;
            sizeData.forEach(row => {
              const diff = Math.abs(row.waist - wCm);
              if (diff < minDiff) {
                minDiff = diff;
                bestRow = row;
              }
            });
            if (minDiff < bestWaistDiff) {
              bestWaistDiff = minDiff;
              bestAnchor = s;
              matchedRow = bestRow;
            }
          }
        });
        if (bestAnchor && matchedRow) {
          let modelMsg = '';
          if (textData?.modelHeight && productInseam) {
            modelMsg = `Model is ${textData.modelHeight}cm. Both of you have a ${productInseam}cm inseam, so L${lockedLength} is your perfect length match.`;
          }
          return {
            size: bestAnchor,
            confidence: 1.0,
            category: 'bottom',
            userChest: originalWaist,
            targetChest: userWaist,
            buffer: 0,
            fitNote: modelMsg || inseamAnchorNote,
            userWaist: originalWaist,
            userHip: parseInt(userProfile.hip),
            userInseam: userInseam || undefined,
            userHeight: userHeight || undefined,
            matchedRow,
            inseamLength: productInseam,
            inseamLengthSize: productInseamSize
          };
        }
      }

      // If no exact match, find closest
      let bestSize = '';
      let bestWaistDiff = Infinity;
      let bestInseamDiff = Infinity;
      dropdownSizes.forEach(s => {
        const sizeMatch = s.match(wxlRegex);
        if (sizeMatch) {
          const w = parseInt(sizeMatch[1]);
          const l = parseInt(sizeMatch[2]);
          const waistDiff = Math.abs(w - targetW);
          const inseamDiff = Math.abs(l - targetL);
          if (waistDiff < bestWaistDiff || (waistDiff === bestWaistDiff && inseamDiff < bestInseamDiff)) {
            bestSize = s;
            bestWaistDiff = waistDiff;
            bestInseamDiff = inseamDiff;
          }
        }
      });
      if (bestSize && (bestWaistDiff <= 2 || bestInseamDiff <= 2)) {
        let fitNote = 'Closest W/L match';
        if (bestWaistDiff > 0) {
          fitNote += ` (waist ${bestWaistDiff}" difference)`;
        }
        if (bestInseamDiff > 0) {
          fitNote += ` (length ${bestInseamDiff}" difference)`;
        }
        if (sizeAdjustmentNote) {
          fitNote = sizeAdjustmentNote + ' • ' + fitNote;
        }
        // === DUAL FIT for non-exact match ===
        if (heightDiff >= 7) {
          const match = bestSize.match(wxlRegex);
          if (match) {
            const currentW = parseInt(match[1]);
            const currentL = parseInt(match[2]);
            const shorterLengthSize = dropdownSizes.find(s => {
              const m = s.match(wxlRegex);
              if (m) {
                const w = parseInt(m[1]);
                const l = parseInt(m[2]);
                return w === currentW && l < currentL;
              }
              return false;
            });
            const smallerWaistSize = dropdownSizes.find(s => {
              const m = s.match(wxlRegex);
              if (m) {
                const w = parseInt(m[1]);
                const l = parseInt(m[2]);
                return w === currentW - 1 && l === currentL;
              }
              return false;
            });
            const secondarySize = shorterLengthSize || smallerWaistSize;
            if (secondarySize) {
              const heightWarning = `You are ${heightDiff}cm shorter than the model. ${bestSize} matches your waist, but a shorter length might prevent bunching at the ankles.`;
              const secondaryLabel = shorterLengthSize ? 'Short Fit' : 'Smaller Alternative';
              return {
                size: bestSize,
                confidence: 0.9,
                category: 'bottom',
                userChest: originalWaist,
                targetChest: userWaist,
                buffer: 0,
                fitNote: 'Comfort Fit • ' + fitNote,
                lengthNote: heightWarning,
                userWaist: originalWaist,
                userHip: parseInt(userProfile.hip),
                userInseam: userInseam || undefined,
                userHeight: userHeight || undefined,
                isDual: true,
                secondarySize: secondarySize,
                secondarySizeNote: secondaryLabel
              };
            }
          }
        }
        return {
          size: bestSize,
          confidence: 0.9,
          category: 'bottom',
          userChest: originalWaist,
          targetChest: userWaist,
          buffer: 0,
          fitNote: fitNote.trim(),
          userWaist: originalWaist,
          userHip: parseInt(userProfile.hip),
          userInseam: userInseam || undefined,
          userHeight: userHeight || undefined,
          inseamLength: productInseam,
          inseamLengthSize: productInseamSize
        };
      }
    }
  }
  return null;
}
