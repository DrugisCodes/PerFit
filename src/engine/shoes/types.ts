/**
 * Type definitions for shoe size calculations
 */

/**
 * Interface for shoe size with interpolation support
 */
export interface ShoeSize {
  size: string;
  footLength: number;
  isInterpolated: boolean;
  rowIndex?: number;
}

/**
 * Context information about shoe construction and store data
 * Used to determine fit rules and adjustments
 */
export interface ShoeContext {
  /** True if shoe is a moccasin-style slip-on (mokkasinsøm, semsket skinn) */
  isMoccasin?: boolean;
  /** True if shoe is a leather boot (støvlett, boot) */
  isLeatherBoot?: boolean;
  /** True if shoe has laces for securing fit */
  hasLaces?: boolean;
  /** Store's recommended size from page text */
  storeRecommendation?: string;
  /** Explicit size recommendation from product description (e.g., "vi anbefaler størrelse 43") */
  recommendedSizeFromText?: string;
  /** Material description for fit notes */
  materialInfo?: string;
  /** User manually selected slip-on/moccasin mode */
  manualOverride?: boolean;
  /** True if product is ankle-length (ankelsokker) */
  isAnkleLength?: boolean;
}

/**
 * Buffer limits for shoe sizing based on construction type
 */
export interface BufferLimits {
  /** Maximum acceptable buffer over foot length (positive = room) */
  maxAllowedBuffer: number;
  /** Minimum acceptable buffer under foot length (negative = tight) */
  minAllowedBuffer: number;
}

/**
 * Construction type classification for shoes
 */
export type ShoeConstruction = 'chelsea' | 'loafer' | 'laced' | 'unknown';
