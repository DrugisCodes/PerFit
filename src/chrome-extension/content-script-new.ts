// TOP-LEVEL GUARD: Exit immediately if not a product page (BEFORE any imports)
const pathname = window.location.pathname.toLowerCase();
if ((!pathname.includes(".html") && !pathname.includes("/p/")) || pathname.includes("-home")) {
  throw new Error("PerFit: Not a product page, aborting.");
}

/**
 * PerFit Content Script - Simplified Version
 * 
 * Direct DOM injection without Shadow DOM complexity.
 * Focuses on reliable dropdown scraping and size matching.
 */

import { detectProvider } from '../stores';
import { UserProfile, SizeRecommendation, GarmentCategory } from '../stores/types';
import { calculateRecommendation, calculateTextBasedRecommendation } from './RecommendationEngine';

/**
 * Cached recommendation for Resume State pattern
 * Stores the last successful size recommendation to avoid re-scraping
 */
let cachedRecommendation: SizeRecommendation | null = null;

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
function analyzeLengthFit(
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

/**
 * Inject UI element into isolated Shadow DOM container
 * Uses React Root Sibling strategy to avoid hydration collisions
 */
const injectIsolatedUI = (element: HTMLElement, hostId: string): void => {
  // Use requestIdleCallback to avoid collision with React startup
  (window.requestIdleCallback || window.setTimeout)(() => {
    let host = document.getElementById(hostId);
    
    if (!host) {
      // Use custom tag name to prevent React's CSS scanners from reacting
      host = document.createElement('perfit-root');
      host.id = hostId;
      
      // CRITICAL: Find Zalando's React Root and inject as SIBLING (not child)
      // This keeps our extension outside React's Virtual DOM tree
      const reactRoot = document.getElementById('z-pdp-root') 
                     || document.getElementById('app') 
                     || document.getElementById('root')
                     || document.body;
      
      if (reactRoot && reactRoot.parentNode) {
        // Insert as sibling BEFORE the React root
        reactRoot.parentNode.insertBefore(host, reactRoot);
      } else {
        // Fallback: append to documentElement if React root not found
        document.documentElement.appendChild(host);
      }
      
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.appendChild(element);
    } else {
      host.shadowRoot?.replaceChildren(element);
    }
  });
};

/**
 * Show size recommendation popup
 * Simple direct injection into document.body
 */
function showRecommendation(recommendation: SizeRecommendation): void {
  // Prevent immediate closure from click-outside handler
  setMenuOpening();
  
  // Remove existing recommendation if present
  const existingBox = document.getElementById('perfit-recommendation');
  if (existingBox) {
    existingBox.remove();
  }

  // Category emoji
  const categoryEmoji: Record<GarmentCategory, string> = {
    'top': '👕',
    'bottom': '👖',
    'shoes': '👟',
    'unknown': '👔'
  };

  // Build message based on category
  let measurementText = '';
  let tableInfo = '';
  
  if (recommendation.category === 'top') {
    measurementText = `Your chest: ${recommendation.userChest}cm`;
    tableInfo = recommendation.matchedRow 
      ? `Table: ${recommendation.matchedRow.chest}cm chest` 
      : '';
  } else if (recommendation.category === 'bottom') {
    measurementText = `Your waist & hip`;
    tableInfo = recommendation.matchedRow 
      ? `Table: ${recommendation.matchedRow.waist}cm waist / ${recommendation.matchedRow.hip}cm hip` 
      : '';
    if (recommendation.fitNote) {
      tableInfo += `<br><span style="color: #48bb78; font-weight: bold;">${recommendation.fitNote}</span>`;
    }
  } else if (recommendation.category === 'shoes') {
    measurementText = `Your foot: ${recommendation.userChest}cm`;
    if (recommendation.fitNote) {
      tableInfo = `<span style="color: #48bb78; font-weight: bold;">${recommendation.fitNote}</span>`;
    }
  } else {
    measurementText = `Your measurement: ${recommendation.userChest}cm`;
  }

  // Create recommendation box - simple inline styles
  const box = document.createElement('div');
  box.id = 'perfit-recommendation';
  box.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
    padding: 20px 24px !important;
    border-radius: 16px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
    z-index: 999999 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    max-width: 300px !important;
    animation: slideIn 0.3s ease-out !important;
    pointer-events: auto !important;
  `;

  box.innerHTML = `
    <style>
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    </style>
    <span id="perfit-close" style="position: absolute; top: 8px; right: 12px; font-size: 28px; font-weight: bold; color: white; cursor: pointer; opacity: 0.7; line-height: 1; user-select: none;">×</span>
    <div style="text-align: center; padding: 10px 0;">
      <div style="font-size: 48px; font-weight: bold; margin-bottom: 8px; text-shadow: 0 2px 8px rgba(0,0,0,0.3);">
        ${recommendation.size}
      </div>
      <div style="font-size: 16px; font-weight: bold; letter-spacing: 1.5px; margin-bottom: 16px; opacity: 0.95;">
        ⭐ PerFit Match
      </div>
      <div style="font-size: 13px; opacity: 0.9; line-height: 1.5; margin-top: 12px;">
        ${categoryEmoji[recommendation.category]} ${measurementText}
      </div>
      ${tableInfo ? `
        <div style="font-size: 11px; opacity: 0.85; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
          ${tableInfo}
        </div>
      ` : ''}
      ${recommendation.lengthNote ? `
        <div style="
          font-size: 12px; 
          margin-top: 12px; 
          padding: 12px; 
          background: rgba(255, 193, 7, 0.25); 
          border: 1.5px solid rgba(255, 193, 7, 0.6); 
          border-radius: 8px; 
          color: #fff; 
          line-height: 1.5;
          font-weight: 500;
          text-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">
          📏 ${recommendation.lengthNote}
        </div>
      ` : ''}
    </div>
  `;

  // Close button handler
  const closeButton = box.querySelector('#perfit-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      box.style.transition = 'opacity 0.3s ease-out';
      box.style.opacity = '0';
      setTimeout(() => box.remove(), 300);
    });
  }

  // Inject using requestIdleCallback to avoid React collision
  injectIsolatedUI(box, 'perfit-recommendation-host');

  // Auto-hide after 15 seconds
  setTimeout(() => {
    if (box.parentNode) {
      box.style.transition = 'opacity 0.5s ease-out';
      box.style.opacity = '0';
      setTimeout(() => box.remove(), 500);
    }
  }, 15000);
}

/**
 * Main execution function - Runs size recommendation logic
 */
async function runPerFit(): Promise<void> {
  try {
    console.log("PerFit: Running recommendation...");

    const provider = detectProvider();
    if (!provider) {
      console.log("PerFit: Provider not detected");
      removeActionMenu();
      return;
    }

    // Fetch user profile
    const result = await chrome.storage.local.get(["userProfile"]);
    const userProfile: UserProfile = result.userProfile;

    if (!userProfile) {
      console.log("PerFit: No user profile found");
      removeActionMenu();
      return;
    }

    console.log("PerFit: User profile loaded");

    // Open size guide
    const opened = await provider.openSizeGuide();
    if (!opened) {
      console.error("PerFit: Failed to open size guide");
      removeActionMenu();
      return;
    }
    // Get fit hint early (needed for text-based fallback)
    let fitHint: string | undefined;
    if ('getFitHint' in provider && typeof provider.getFitHint === 'function') {
      fitHint = (provider as any).getFitHint() || undefined;
    }
    // Scrape size data
    const sizeData = await provider.scrapeTableData();
    if (sizeData.length === 0) {
      console.log("PerFit: No table data found, checking for text-based measurements...");
      
      // Check if provider has text measurements (Zalando-specific)
      if ('textMeasurement' in provider && (provider as any).textMeasurement) {
        const textData = (provider as any).textMeasurement;
        console.log("PerFit: Using text-based measurements", textData);
        
        // Calculate text-based recommendation
        const recommendation = calculateTextBasedRecommendation(userProfile, textData);
        
        if (recommendation) {
          // Add length/height analysis
          const lengthWarning = analyzeLengthFit(userProfile, textData, recommendation.size);
          if (lengthWarning) {
            recommendation.lengthNote = lengthWarning;
            console.log("PerFit: Length warning added:", lengthWarning);
          }
          
          cachedRecommendation = recommendation; // Cache text-based result
          removeActionMenu(); // Remove menu before showing recommendation
          showRecommendation(recommendation);
          return;
        }
      }
      
      console.error("PerFit: No size data or text measurements available");
      removeActionMenu();
      return;
    }

    // Detect category
    const category = provider.getTableCategory();
    console.log(`PerFit: Category: ${category}`);

    // Get text measurements if available (for ankle length detection)
    const textMeasurement = ('textMeasurement' in provider && (provider as any).textMeasurement) 
      ? (provider as any).textMeasurement 
      : undefined;

    // Get dropdown sizes if available (for WxL format detection)
    const dropdownSizes = ('dropdownSizes' in provider && (provider as any).dropdownSizes) 
      ? (provider as any).dropdownSizes 
      : undefined;

    // Calculate recommendation (pass textMeasurement for ankle length detection and dropdownSizes for WxL format)
    const recommendation = calculateRecommendation(userProfile, sizeData, category, fitHint, textMeasurement, dropdownSizes);
    if (!recommendation) {
      console.error("PerFit: Failed to calculate recommendation");
      removeActionMenu();
      return;
    }

    // Add length/height analysis (check if provider has text measurements and category is not shoes)
    if (category !== 'shoes' && textMeasurement) {
      const lengthWarning = analyzeLengthFit(userProfile, textMeasurement, recommendation.size);
      if (lengthWarning) {
        recommendation.lengthNote = lengthWarning;
        console.log("PerFit: Length warning added:", lengthWarning);
      }
    }

    // Highlight row
    if (recommendation.matchedRow && recommendation.matchedRow.rowIndex !== undefined) {
      let rowIndexToHighlight = recommendation.matchedRow.rowIndex;
      
      // If rowIndex is -1 (no exact match, interpolated size), find nearest row in ORIGINAL table
      if (rowIndexToHighlight === -1 && sizeData.length > 0) {
        console.log("PerFit: No exact match found (interpolated size), finding nearest row in original table for size:", recommendation.size);
        
        // Extract numeric value from recommended size (e.g., "43 1/3" -> 43.333)
        const recommendedValue = parseFloat(recommendation.size.replace(/\s+\d+\/\d+/, (match: string) => {
          const parts = match.trim().split(/\s+/);
          if (parts.length > 1) {
            const fraction = parts[1].split('/');
            return ' ' + (parseInt(fraction[0]) / parseInt(fraction[1])).toString();
          }
          return match;
        }));
        
        // Find row with closest size value that has a VALID rowIndex (from original table)
        // Filter out interpolated rows (they might have rowIndex -1 or invalid indices)
        let minDiff = Infinity;
        let nearestRowIndex = -1;
        let nearestRowSize = '';
        
        sizeData.forEach((row) => {
          // Only consider rows that exist in the original table (rowIndex >= 0)
          if (row.rowIndex >= 0 && row.intSize) {
            const rowValue = parseFloat(row.intSize.replace(/\s+\d+\/\d+/, (match: string) => {
              const parts = match.trim().split(/\s+/);
              if (parts.length > 1) {
                const fraction = parts[1].split('/');
                return ' ' + (parseInt(fraction[0]) / parseInt(fraction[1])).toString();
              }
              return match;
            }));
            
            const diff = Math.abs(rowValue - recommendedValue);
            if (diff < minDiff) {
              minDiff = diff;
              nearestRowIndex = row.rowIndex;
              nearestRowSize = row.intSize;
            }
          }
        });
        
        if (nearestRowIndex >= 0) {
          console.log(`PerFit: Found nearest original table row at index ${nearestRowIndex} (size: ${nearestRowSize})`);
          rowIndexToHighlight = nearestRowIndex;
        }
      }
      
      // Only highlight if we have a valid index
      if (rowIndexToHighlight >= 0) {
        provider.highlightRow(rowIndexToHighlight, recommendation.fitNote);
      }
    }

    // Cache the recommendation for Resume State
    cachedRecommendation = recommendation;

    // Show recommendation
    console.log(`PerFit: ✅ Recommendation: ${recommendation.size}`);
    removeActionMenu(); // Remove menu before showing recommendation
    showRecommendation(recommendation);

  } catch (error) {
    console.error("PerFit: Error:", error);
    removeActionMenu(); // Always clean up on error
  }
}

/**
 * Remove the action menu from DOM
 */
function removeActionMenu(): void {
  const host = document.getElementById('perfit-action-host');
  if (host) {
    host.remove();
    console.log("PerFit: Action menu removed");
  }
}

/**
 * Show action menu popup - Simplified design
 */
function showActionMenu(): void {
  // Prevent immediate closure from click-outside handler
  setMenuOpening();
  
  const hostId = 'perfit-action-host';
  let host = document.getElementById(hostId);
  
  if (!host) {
    host = document.createElement('perfit-root');
    host.id = hostId;
    
    // Sibling Injection: Finn React-roten og legg oss ved siden av
    const reactRoot = document.getElementById('z-pdp-root') || document.body.firstElementChild;
    if (reactRoot && reactRoot.parentNode) {
      reactRoot.parentNode.insertBefore(host, reactRoot);
    } else {
      document.body.prepend(host);
    }

    const shadow = host.attachShadow({ mode: 'open' });
    const menu = document.createElement('div');
    
    // Styling basert på bildene dine
    menu.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: white; padding: 24px; border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      width: 300px; z-index: 2147483647; font-family: sans-serif;
      text-align: center; display: flex; flex-direction: column; gap: 16px;
    `;

    shadow.appendChild(menu);

    // Render functions for different views
    const renderStartView = () => {
      menu.innerHTML = `
        <div style="font-size: 24px; font-weight: bold; color: #111827; display: flex; align-items: center; justify-content: center;">
          <img src="${chrome.runtime.getURL('logo.png')}" alt="PerFit Logo" style="height: 48px; width: auto; vertical-align: middle; margin-right: 10px;">
          PerFit
        </div>
        
        <button id="perfit-run" style="
          background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%); color: white; border: none;
          padding: 10px 24px; border-radius: 50px; width: 100%;
          font-size: 16px; font-weight: bold; cursor: pointer;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        ">Measure size</button>

        <div id="perfit-edit" style="
          color: #6b7280; font-size: 14px; cursor: pointer;
          text-decoration: underline; margin-top: 4px;
        ">Change your measurements</div>
      `;

      // Knappe-logikk for start view
      shadow.getElementById('perfit-run')?.addEventListener('click', async () => {
        const button = shadow.getElementById('perfit-run') as HTMLButtonElement;
        if (button) {
          // Show loading state
          button.disabled = true;
          button.style.opacity = '0.6';
          button.style.cursor = 'not-allowed';
          button.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
              <div style="
                width: 16px; height: 16px; border: 2px solid white;
                border-top-color: transparent; border-radius: 50%;
                animation: spin 0.8s linear infinite;
              "></div>
              <span>Loading...</span>
            </div>
            <style>
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            </style>
          `;
        }
        
        // Run the recommendation logic
        await runPerFit();
      });

      shadow.getElementById('perfit-edit')?.addEventListener('click', async () => {
        renderEditView();
      });
    };

    const renderEditView = async () => {
      // Load current profile from storage
      const result = await chrome.storage.local.get(['userProfile']);
      const profile = result.userProfile || {};

      menu.innerHTML = `
        <div style="font-size: 24px; font-weight: bold; color: #111827; display: flex; align-items: center; justify-content: center;">
          <img src="${chrome.runtime.getURL('logo.png')}" alt="PerFit Logo" style="height: 48px; width: auto; vertical-align: middle; margin-right: 10px;">
          PerFit
        </div>

        <style>
          .perfit-scroll-container::-webkit-scrollbar {
            width: 6px;
          }
          .perfit-scroll-container::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 3px;
          }
          .perfit-scroll-container::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 3px;
          }
          .perfit-scroll-container::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        </style>

        <div class="perfit-scroll-container" style="
          max-height: 250px; 
          overflow-y: auto; 
          text-align: left; 
          display: flex; 
          flex-direction: column; 
          gap: 8px;
          padding-right: 8px;
        ">
          <div>
            <label style="display: block; color: #374151; font-size: 13px; font-weight: 500; margin-bottom: 4px;">👔 Chest (cm)</label>
            <input id="input-chest" type="number" value="${profile.chest || ''}" style="
              width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
              font-size: 14px; box-sizing: border-box;
            ">
          </div>
          <div>
            <label style="display: block; color: #374151; font-size: 13px; font-weight: 500; margin-bottom: 4px;">📏 Waist (cm)</label>
            <input id="input-waist" type="number" value="${profile.waist || ''}" style="
              width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
              font-size: 14px; box-sizing: border-box;
            ">
          </div>
          <div>
            <label style="display: block; color: #374151; font-size: 13px; font-weight: 500; margin-bottom: 4px;">👖 Hip (cm)</label>
            <input id="input-hip" type="number" value="${profile.hip || ''}" style="
              width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
              font-size: 14px; box-sizing: border-box;
            ">
          </div>
          <div>
            <label style="display: block; color: #374151; font-size: 13px; font-weight: 500; margin-bottom: 4px;">💪 Arm Length (cm)</label>
            <input id="input-armLength" type="number" value="${profile.armLength || ''}" style="
              width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
              font-size: 14px; box-sizing: border-box;
            ">
          </div>
          <div>
            <label style="display: block; color: #374151; font-size: 13px; font-weight: 500; margin-bottom: 4px;">🦵 Inseam / Inside Leg (cm)</label>
            <input id="input-inseam" type="number" value="${profile.inseam || ''}" style="
              width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
              font-size: 14px; box-sizing: border-box;
            ">
          </div>
          <div>
            <label style="display: block; color: #374151; font-size: 13px; font-weight: 500; margin-bottom: 4px;">📐 Torso Length (cm)</label>
            <input id="input-torsoLength" type="number" value="${profile.torsoLength || ''}" style="
              width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
              font-size: 14px; box-sizing: border-box;
            ">
          </div>
          <div>
            <label style="display: block; color: #374151; font-size: 13px; font-weight: 500; margin-bottom: 4px;">📏 Height / Høyde (cm)</label>
            <input id="input-height" type="number" value="${profile.height || ''}" style="
              width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
              font-size: 14px; box-sizing: border-box;
            ">
          </div>
          <div>
            <label style="display: block; color: #374151; font-size: 13px; font-weight: 500; margin-bottom: 4px;">📏 Foot Length (cm)</label>
            <input id="input-footLength" type="number" value="${profile.footLength || ''}" style="
              width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
              font-size: 14px; box-sizing: border-box;
            ">
          </div>
          <div>
            <label style="display: block; color: #374151; font-size: 13px; font-weight: 500; margin-bottom: 4px;">👟 Shoe Size (Optional)</label>
            <input id="input-shoeSize" type="text" value="${profile.shoeSize || ''}" style="
              width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
              font-size: 14px; box-sizing: border-box;
            ">
          </div>
        </div>

        <button id="perfit-save" style="
          background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%); color: white; border: none;
          padding: 10px 24px; border-radius: 50px; width: 100%;
          font-size: 16px; font-weight: bold; cursor: pointer;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          margin-top: 8px;
        ">Save</button>
      `;

      // Save button logic
      shadow.getElementById('perfit-save')?.addEventListener('click', async () => {
        const chest = (shadow.getElementById('input-chest') as HTMLInputElement)?.value;
        const waist = (shadow.getElementById('input-waist') as HTMLInputElement)?.value;
        const hip = (shadow.getElementById('input-hip') as HTMLInputElement)?.value;
        const armLength = (shadow.getElementById('input-armLength') as HTMLInputElement)?.value;
        const inseam = (shadow.getElementById('input-inseam') as HTMLInputElement)?.value;
        const torsoLength = (shadow.getElementById('input-torsoLength') as HTMLInputElement)?.value;
        const height = (shadow.getElementById('input-height') as HTMLInputElement)?.value;
        const footLength = (shadow.getElementById('input-footLength') as HTMLInputElement)?.value;
        const shoeSize = (shadow.getElementById('input-shoeSize') as HTMLInputElement)?.value;

        // Update profile in storage
        const updatedProfile = {
          ...profile,
          chest,
          waist,
          hip,
          armLength,
          inseam,
          torsoLength,
          height,
          footLength,
          shoeSize
        };

        await chrome.storage.local.set({ userProfile: updatedProfile });
        console.log('PerFit: Profile updated', updatedProfile);

        // Return to start view
        renderStartView();
      });
    };

    // Initialize with start view
    renderStartView();
  }
}

/**
 * Handle activation - Smart logic for Resume State
 * 
 * Scenario A: Cached recommendation exists -> Show it immediately
 * Scenario B: No cache -> Show action menu
 * Scenario C: UI already visible -> Toggle (close it)
 */
function handleActivation(): void {
  // Check if any UI is already visible
  const menuVisible = !!document.getElementById('perfit-action-host');
  const recommendationVisible = !!document.getElementById('perfit-recommendation-host');
  
  if (menuVisible || recommendationVisible) {
    // Scenario C: Toggle - close existing UI
    removeActionMenu();
    removeRecommendation();
    console.log("PerFit: Toggled UI off");
    return;
  }
  
  if (cachedRecommendation) {
    // Scenario A: Show cached recommendation directly
    console.log("PerFit: Showing cached recommendation");
    setMenuOpening();
    showRecommendation(cachedRecommendation);
  } else {
    // Scenario B: No cache - show action menu
    console.log("PerFit: Showing action menu");
    setMenuOpening();
    showActionMenu();
  }
}

/**
 * Remove recommendation box from DOM
 */
function removeRecommendation(): void {
  const host = document.getElementById('perfit-recommendation-host');
  if (host) {
    host.remove();
    console.log("PerFit: Recommendation removed");
  }
}

/**
 * Click-to-Run Entry Point
 * Runs immediately when injected by background service worker
 */

// Listen for activation messages from background script (Resume State)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "ACTIVATE_PERFIT") {
    console.log("PerFit: Received activation message");
    handleActivation();
    sendResponse({ success: true });
  }
  return true; // Keep message channel open for async response
});

// Click-outside-to-close functionality
let isOpeningMenu = false;

window.addEventListener('mousedown', (event) => {
  // Ignore if we're currently opening a menu
  if (isOpeningMenu) {
    isOpeningMenu = false;
    return;
  }

  const actionHost = document.getElementById('perfit-action-host');
  const recommendationHost = document.getElementById('perfit-recommendation-host');

  // Check if click is outside both menus
  const clickedOutsideAction = actionHost && !actionHost.contains(event.target as Node);
  const clickedOutsideRecommendation = recommendationHost && !recommendationHost.contains(event.target as Node);

  if (clickedOutsideAction) {
    removeActionMenu();
  }

  if (clickedOutsideRecommendation) {
    removeRecommendation();
  }
}, true); // Use capture phase to handle before any other handlers

// Helper function to prevent immediate closure when opening menu
function setMenuOpening(): void {
  isOpeningMenu = true;
  setTimeout(() => {
    isOpeningMenu = false;
  }, 300); // Increased from 100ms to 300ms to prevent immediate closure
}

// NUCLEAR GUARD: Tillater produktsider (.html eller /p/) så lenge det ikke er en kategoriside
const path = window.location.pathname.toLowerCase();
const isProduct = (path.includes(".html") || path.includes("/p/")) && !path.includes("-home");

if (!isProduct) {
  console.log("PerFit: Not a product page, stopping.");
} else {
  // Initial activation on fresh injection
  handleActivation();
}
