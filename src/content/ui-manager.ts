/**
 * PerFit Content Script - UI Manager Module
 * 
 * Handles all UI-related functions:
 * - Shadow DOM injection
 * - Recommendation display
 * - Action menu (start view and edit view)
 * - UI removal
 */

import { SizeRecommendation, GarmentCategory } from '../stores/types';

// Track if menu is being opened (to prevent immediate click-outside closure)
let isOpeningMenu = false;

/**
 * Helper function to prevent immediate closure when opening menu
 */
export function setMenuOpening(): void {
  isOpeningMenu = true;
  setTimeout(() => {
    isOpeningMenu = false;
  }, 300); // Increased from 100ms to 300ms to prevent immediate closure
}

/**
 * Check if menu is currently being opened
 */
export function getIsOpeningMenu(): boolean {
  return isOpeningMenu;
}

/**
 * Reset the menu opening flag
 */
export function resetMenuOpening(): void {
  isOpeningMenu = false;
}

/**
 * Inject UI element into isolated Shadow DOM container
 * Uses React Root Sibling strategy to avoid hydration collisions
 */
export function injectIsolatedUI(element: HTMLElement, hostId: string): void {
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
}

/**
 * Show size recommendation popup
 * Simple direct injection into document.body
 */
export function showRecommendation(recommendation: SizeRecommendation): void {
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
    measurementText = `Din fotlengde: ${recommendation.userChest}cm`;
    if (recommendation.fitNote) {
      tableInfo = `<span style="color: #48bb78; font-weight: bold;">${recommendation.fitNote}</span>`;
    }
  } else {
    measurementText = `Your measurement: ${recommendation.userChest}cm`;
  }

  // === DUAL RECOMMENDATION LAYOUT FOR MOCCASINS ===
  let sizeDisplayHtml = '';
  const isDual = recommendation.isDual;
  
  if (isDual && recommendation.secondarySize) {
    // Visning for to størrelser ved siden av hverandre
    sizeDisplayHtml = `
      <div style="display: flex; gap: 12px; justify-content: center; margin-bottom: 15px;">
        <div style="flex: 1; background: rgba(255,255,255,0.15); padding: 12px; border-radius: 12px; border: 2px solid #fff; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${recommendation.size}</div>
          <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin-top: 4px;">Tettsitt.</div>
          <div style="font-size: 9px; opacity: 0.9;">(Anbefalt)</div>
        </div>
        
        <div style="flex: 1; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; border: 1px dashed rgba(255,255,255,0.5); opacity: 0.8; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${recommendation.secondarySize}</div>
          <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin-top: 4px;">Komfortab.</div>
          <div style="font-size: 9px; opacity: 0.9;">(Kan utv.)</div>
        </div>
      </div>
    `;
  } else {
    // Standard visning for én størrelse
    sizeDisplayHtml = `
      <div style="font-size: 48px; font-weight: bold; margin-bottom: 8px; text-shadow: 0 2px 8px rgba(0,0,0,0.3);">
        ${recommendation.size}
      </div>
    `;
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
      ${sizeDisplayHtml}
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
      ${isDual ? `
        <div style="font-size: 11px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; line-height: 1.4; text-align: left; margin-top: 12px;">
          💡 <strong>Skinn utvider seg over tid.</strong> Vi anbefaler den minste størrelsen for å unngå at skoen glipper i hælen senere.
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
 * Remove the action menu from DOM
 */
export function removeActionMenu(): void {
  const host = document.getElementById('perfit-action-host');
  if (host) {
    host.remove();
    console.log("PerFit: Action menu removed");
  }
}

/**
 * Remove recommendation box from DOM
 */
export function removeRecommendation(): void {
  const host = document.getElementById('perfit-recommendation-host');
  if (host) {
    host.remove();
    console.log("PerFit: Recommendation removed");
  }
}

/**
 * Show action menu popup - Simplified design
 * 
 * @param runPerFitCallback - Callback function to run recommendation logic
 * @param manualOverride - Optional manual override for stretch detection
 */
export function showActionMenu(
  runPerFitCallback: (manualOverride?: boolean) => Promise<void>,
  manualOverride?: boolean
): void {
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

      // Button logic for start view
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
        
        // Run the recommendation logic with manual override
        await runPerFitCallback(manualOverride);
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
          <div>
            <label style="display: block; color: #374151; font-size: 13px; font-weight: 500; margin-bottom: 4px;">🦶 Foot Width / Fotbredde</label>
            <select id="input-footWidth" style="
              width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
              font-size: 14px; box-sizing: border-box; background: white;
            ">
              <option value="" ${!profile.footWidth ? 'selected' : ''}>-- Velg --</option>
              <option value="narrow" ${profile.footWidth === 'narrow' ? 'selected' : ''}>Smal</option>
              <option value="average" ${profile.footWidth === 'average' ? 'selected' : ''}>Normal</option>
              <option value="wide" ${profile.footWidth === 'wide' ? 'selected' : ''}>Bred</option>
            </select>
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
        const footWidth = (shadow.getElementById('input-footWidth') as HTMLSelectElement)?.value as 'narrow' | 'average' | 'wide' | '';

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
          shoeSize,
          footWidth: footWidth || undefined // Don't save empty string
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
