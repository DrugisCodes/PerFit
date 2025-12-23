// TOP-LEVEL GUARD: Exit immediately if not a product page (BEFORE any imports)
if (!window.location.pathname.endsWith(".html") || window.location.pathname.includes("-home")) {
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

    // Calculate recommendation
    const recommendation = calculateRecommendation(userProfile, sizeData, category, fitHint);
    if (!recommendation) {
      console.error("PerFit: Failed to calculate recommendation");
      removeActionMenu();
      return;
    }

    // Add length/height analysis (check if provider has text measurements)
    if ('textMeasurement' in provider && (provider as any).textMeasurement) {
      const textData = (provider as any).textMeasurement;
      const lengthWarning = analyzeLengthFit(userProfile, textData, recommendation.size);
      if (lengthWarning) {
        recommendation.lengthNote = lengthWarning;
        console.log("PerFit: Length warning added:", lengthWarning);
      }
    }

    // Highlight row
    if (recommendation.matchedRow && recommendation.matchedRow.rowIndex !== undefined) {
      provider.highlightRow(recommendation.matchedRow.rowIndex, recommendation.fitNote);
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

    shadow.appendChild(menu);

    // Knappe-logikk
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

    shadow.getElementById('perfit-edit')?.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
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
    showRecommendation(cachedRecommendation);
  } else {
    // Scenario B: No cache - show action menu
    console.log("PerFit: Showing action menu");
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

// NUCLEAR GUARD: Tillater alle sider som ender på .html, så lenge det ikke er en kategoriside
const path = window.location.pathname.toLowerCase();
const isProduct = path.endsWith(".html") && !path.includes("-home");

if (!isProduct) {
  console.log("PerFit: Not a product page, stopping.");
} else {
  // Initial activation on fresh injection
  handleActivation();
}
