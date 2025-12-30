/**
 * Core types for store providers
 * 
 * This file defines the interface that all store providers must implement.
 * Each provider handles a specific online store (Zalando, ASOS, etc.)
 */

/**
 * Garment category types
 * Used to determine which body measurement to use for size matching
 */
export type GarmentCategory = 'top' | 'bottom' | 'shoes' | 'unknown';

/**
 * Text-based measurement data (fallback when tables are missing)
 * Used by Zalando and other stores that provide model info in text format
 */
export interface TextMeasurement {
  modelHeight?: number;      // Model's height in cm (e.g., 189)
  modelSize: string;         // Size the model is wearing (e.g., "M")
  itemLength?: number;       // Item length in cm (e.g., 69)
  itemLengthSize?: string;   // Size for which length is specified (e.g., "M")
  inseamLength?: number;     // Inside leg length in cm (e.g., 78) - extracted from "Lengde innside ben"
  inseamLengthSize?: string; // Size for which inseam is specified (e.g., "33x32")
  isAnkleLength?: boolean;   // Whether item is designed as ankle length
  fitHint?: string;          // Fit hint: 'liten' or 'stor' (small/large)
  isMoccasin?: boolean;      // Whether item is a moccasin/loafer (stretches significantly)
  isLeatherBoot?: boolean;   // Whether item is a leather boot (stretches less than moccasin)
  hasLaces?: boolean;        // Whether boot has laces (affects fit - laced boots are more adjustable)
  recommendedSizeFromText?: string;  // Expert recommendation from text (e.g., "vi anbefaler størrelse 42")
  storeRecommendation?: string;      // Store's own recommendation based on purchase history
  materialInfo?: string;     // Material description (e.g., "semsket skinn", "lær")
  manualOverride?: boolean;  // Manual user override for moccasin sizing
}

export interface SizeRow {
  intSize: string;      // International size (S, M, L, XL, etc.) or EU shoe size
  chest: number;        // Chest measurement in cm
  waist: number;        // Waist measurement in cm
  hip: number;          // Hip measurement in cm
  inseam?: number;      // Inseam/inner leg length in cm (for pants)
  footLength?: number;  // Foot length in cm (for shoes)
  rowIndex: number;     // Index of the row in the table (for highlighting)
}

export interface UserProfile {
  chest: string;
  waist: string;
  hip: string;
  armLength: string;
  inseam: string;
  torsoLength: string;
  shoeSize: string;
  height: string;         // Height in cm (for text-based matching)
  footLength?: string;    // Foot length in cm (for shoe matching)
  fitPreference?: number; // 1-10, where 5 is regular fit
  // volumentalId?: string; // Future: Volumental API integration for 3D foot scan data
}

/**
 * StoreProvider interface
 * 
 * Each online store must implement this interface to integrate with PerFit.
 */
export interface StoreProvider {
  /**
   * Unique name of the store (e.g., "Zalando", "ASOS")
   */
  name: string;

  /**
   * Check if this provider can handle the current page
   * 
   * @returns true if the current URL matches this store
   */
  canHandle: () => boolean;

  /**
   * Open the size guide modal/accordion on the page
   * 
   * This function should:
   * 1. Find and click the "Fit" or "Size Guide" button
   * 2. Wait for the size table to appear
   * 3. Return true if successful, false otherwise
   * 
   * @returns Promise<boolean> - true if size guide was opened successfully
   */
  openSizeGuide: () => Promise<boolean>;

  /**
   * Scrape size data from the size guide table
   * 
   * This function should:
   * 1. Locate the body measurements table (usually labeled "Kroppsmål" or "Body Measurements")
   * 2. Parse each row to extract INT size, chest, waist, and hip measurements
   * 3. Return an array of SizeRow objects
   * 
   * @returns Promise<SizeRow[]> - Array of size data, or empty array if scraping fails
   */
  scrapeTableData: () => Promise<SizeRow[]> | SizeRow[];

  /**
   * Detect the category of garment from table headers
   * 
   * @param headers - Array of table header text
   * @returns GarmentCategory - The detected category
   */
  detectCategory: (headers: string[]) => GarmentCategory;

  /**
   * Get the category of the currently loaded size table
   * 
   * @returns GarmentCategory - The category of the active table
   */
  getTableCategory: () => GarmentCategory;

  /**
   * Highlight a specific size row in the size table
   * 
   * @param rowIndex - The index of the row to highlight
   * @param fitNote - Optional fit note to display for shoes (e.g., "IDEELL (+0.5 cm plass)")
   */
  highlightRow: (rowIndex: number, fitNote?: string) => void;
}

/**
 * Configuration for size recommendation calculation
 */
export interface RecommendationConfig {
  userProfile: UserProfile;
  sizeData: SizeRow[];
  fitPreference: number; // 1-10
}

/**
 * Result of size recommendation calculation
 */
export interface SizeRecommendation {
  size: string;           // Recommended size (e.g., "XL")
  confidence: number;     // 0-1, how confident we are (future use)
  category: GarmentCategory; // Type of garment
  userChest: number;      // User's chest measurement (or waist for bottoms)
  targetChest: number;    // Target chest after adding buffer (or waist for bottoms)
  buffer: number;         // Buffer added based on fit preference
  matchedRow?: SizeRow;   // The table row that matched
  fitNote?: string;       // Fit difference note for shoes (e.g., "IDEELL (+0.5 cm plass)")
  lengthNote?: string;    // Length/height mismatch warning (e.g., "Modellen er 10 cm høyere enn deg")
  
  // === BOTTOMS-SPECIFIC FIELDS ===
  userWaist?: number;     // User's waist measurement in cm
  userHip?: number;       // User's hip measurement in cm
  userInseam?: number;    // User's inseam/inner leg length in cm
  userHeight?: number;    // User's height in cm
  
  // === INSEAM ANCHOR (for perfect leg match) ===
  inseamLength?: number; // Product inseam in cm (for UI perfect match logic)
  inseamLengthSize?: string; // Size for which inseam was measured (optional, for completeness)
  // === DUAL RECOMMENDATION (for moccasins/loafers and height-based bottoms) ===
  isDual?: boolean;                   // True if showing both snug and comfort options
  secondarySize?: string;             // Larger/comfort fit size (42 is primary, 43 is secondary)
  secondarySizeNote?: string;         // Label for secondary size (e.g., "Shorter Length", "Comfort Fit")
  userFootLength?: number;            // User's foot length in cm
  technicalSize?: string;             // Technical best-fit size (before 'stor' adjustment)
  isStorAdjusted?: boolean;           // True if size was adjusted down due to 'stor' hint
  
  // === STORE RECOMMENDATION CROSS-CHECK ===
  storeRecommendation?: string;       // Store's own recommendation (e.g., from purchase history)
  storeRecommendationNote?: string;   // Cross-check result note
}
