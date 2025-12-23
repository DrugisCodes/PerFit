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

export interface SizeRow {
  intSize: string;      // International size (S, M, L, XL, etc.) or EU shoe size
  chest: number;        // Chest measurement in cm
  waist: number;        // Waist measurement in cm
  hip: number;          // Hip measurement in cm
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
  userChest: number;      // User's chest measurement
  targetChest: number;    // Target chest after adding buffer
  buffer: number;         // Buffer added based on fit preference
  matchedRow?: SizeRow;   // The table row that matched
  fitNote?: string;       // Fit difference note for shoes (e.g., "IDEELL (+0.5 cm plass)")
  lengthNote?: string;    // Length/height mismatch warning (e.g., "Modellen er 10 cm høyere enn deg")
}
