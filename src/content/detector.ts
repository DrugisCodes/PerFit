/**
 * PerFit Content Script - Detector Module
 * 
 * Early category detection from page content.
 * Lightweight detection that doesn't require opening the size guide.
 */

/**
 * Early category detection (lightweight, doesn't open size guide)
 * Uses page content clues to detect category for popup
 * Also scans for moccasin/loafer keywords to pre-set the stretch override
 * 
 * @returns Category string ('shoes', etc.) or null if not detected
 */
export function detectCategoryFromPage(): string | null {
  try {
    const url = window.location.href.toLowerCase();
    
    // === TARGETED MOCCASIN/LOAFER DETECTION ===
    // First, get product name from H1 to check for exclusion words
    const h1Text = document.querySelector('h1')?.textContent?.toLowerCase() || '';
    
    // Exclusion words: If product is a boot or sneaker, don't flag as moccasin
    const bootExclusionWords = ['boot', 'boots', 'støvel', 'støvler', 'støvlett', 'støvletter', 'chelsea', 'ankle boot'];
    const sneakerExclusionWords = ['sneaker', 'sneakers', 'joggesko', 'joggesko', 'treningssko', 'trainer', 'trainers'];
    
    const isBootProduct = bootExclusionWords.some(word => h1Text.includes(word));
    const isSneakerProduct = sneakerExclusionWords.some(word => h1Text.includes(word) || url.includes(word));
    
    // Combined exclusion check - sneakers and boots should never be moccasins
    const shouldExcludeMoccasin = isBootProduct || isSneakerProduct;
    
    // Moccasin keywords to search for
    const moccasinKeywords = ['mokkasinsøm', 'loafers', 'loafer', 'mokkasin', 'moccasin', 'penny loafer', 'driving shoe'];
    
    // Leather keywords for boot detection
    const leatherKeywords = ['lær', 'skinn', 'leather', 'nubuck', 'semsket'];
    
    // Lace keywords for boot differentiation
    const laceKeywords = ['snøre', 'snøring', 'lace', 'laces', 'laced', 'snørings', 'lisser', 'skolisser'];
    
    let isMoccasin = false;
    let isLeatherBoot = false;
    let hasLaces = false;
    
    // TARGETED SCAN: First try Zalando's product details containers
    const productContainers = [
      '[data-testid="pdp-description"]',
      '[data-testid="pdp-details"]',
      '[data-testid="product-details"]',
      '[class*="product-detail"]',
      '[class*="ProductDetails"]',
      'article',
      'main'
    ];
    
    let targetText = '';
    for (const selector of productContainers) {
      const container = document.querySelector(selector);
      if (container) {
        targetText = container.textContent?.toLowerCase() || '';
        if (targetText.length > 50) { // Found meaningful content
          console.log(`PerFit: Bruker målrettet søk i ${selector}`);
          break;
        }
      }
    }
    
    // Fallback to H1 + surrounding content if no container found
    if (targetText.length < 50) {
      targetText = h1Text;
      // Also check product info section near H1
      const productInfo = document.querySelector('[data-testid="pdp-product-info"]');
      if (productInfo) {
        targetText += ' ' + (productInfo.textContent?.toLowerCase() || '');
      }
      console.log('PerFit: Bruker H1 + produktinfo for søk');
    }
    
    // Check for leather in product
    const hasLeather = leatherKeywords.some(word => targetText.includes(word));
    
    // === STEP 1: LACE DETECTION FIRST ===
    // Check for laces BEFORE moccasin detection - laces override moccasin detection
    for (const keyword of laceKeywords) {
      if (targetText.includes(keyword) || h1Text.includes(keyword)) {
        hasLaces = true;
        console.log('PerFit: Lisser/snøring funnet - behandles som sko med snøring!', keyword);
        break;
      }
    }
    
    // === STEP 2: MOCCASIN DETECTION (with exclusions) ===
    // Check for moccasin keywords (only in targeted text, not entire page)
    // Skip if: product is boot, sneaker, OR has laces
    if (!shouldExcludeMoccasin && !hasLaces) {
      for (const keyword of moccasinKeywords) {
        if (targetText.includes(keyword) || h1Text.includes(keyword)) {
          isMoccasin = true;
          console.log('PerFit: Mokkasinsøm funnet i produktdetaljer!', keyword);
          break;
        }
      }
    } else if (shouldExcludeMoccasin) {
      // Check if mokkasinsøm was present but ignored
      const hasMoccasinKeyword = moccasinKeywords.some(keyword => 
        targetText.includes(keyword) || h1Text.includes(keyword)
      );
      if (hasMoccasinKeyword) {
        if (isSneakerProduct) {
          console.log('PerFit: Mokkasinsøm funnet, men ignorert pga. sneaker-kategori');
        } else {
          console.log('PerFit: Mokkasinsøm funnet, men ignorert pga. støvel-kategori');
        }
      }
      
      // Handle boot detection if it's a boot (not sneaker)
      if (isBootProduct && !isSneakerProduct) {
        console.log('PerFit: Produktnavn indikerer støvel - ignorerer loafer-keywords');
        
        // Check if it's a leather boot
        if (hasLeather) {
          isLeatherBoot = true;
          console.log('PerFit: Detektert som lærstøvel');
          
          if (!hasLaces) {
            console.log('PerFit: Støvel uten snøring (Chelsea-type) - bruker tettsittende logikk');
          } else {
            console.log('PerFit: Støvel med snøring funnet');
          }
        }
      }
    } else if (hasLaces) {
      // Laces found - log if moccasin keyword was present
      const hasMoccasinKeyword = moccasinKeywords.some(keyword => 
        targetText.includes(keyword) || h1Text.includes(keyword)
      );
      if (hasMoccasinKeyword) {
        console.log('PerFit: Mokkasinsøm funnet, men ignorert pga. lisser/snøring');
      }
    }
    
    // Store flags in sessionStorage and chrome.storage
    if (isMoccasin) {
      sessionStorage.setItem('perfit-isMoccasin', 'true');
      sessionStorage.removeItem('perfit-isLeatherBoot');
      console.log('PerFit: isMoccasin satt til true');
      
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ perfit_isMoccasin: true, perfit_isLeatherBoot: false });
      }
    } else if (isLeatherBoot) {
      sessionStorage.setItem('perfit-isLeatherBoot', 'true');
      sessionStorage.setItem('perfit-hasLaces', hasLaces ? 'true' : 'false');
      sessionStorage.removeItem('perfit-isMoccasin');
      console.log(`PerFit: isLeatherBoot satt til true, hasLaces: ${hasLaces}`);
      
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ perfit_isMoccasin: false, perfit_isLeatherBoot: true, perfit_hasLaces: hasLaces });
      }
    } else {
      // Clear all flags
      sessionStorage.removeItem('perfit-isMoccasin');
      sessionStorage.removeItem('perfit-isLeatherBoot');
      sessionStorage.removeItem('perfit-hasLaces');
      
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ perfit_isMoccasin: false, perfit_isLeatherBoot: false, perfit_hasLaces: false });
      }
    }
    
    // Check URL for category hints
    if (url.includes('/sko/') || url.includes('/shoes/') || url.includes('/footwear/')) {
      return 'shoes';
    }
    
    // Check breadcrumbs
    const breadcrumbs = document.querySelectorAll('[data-testid="breadcrumb"], nav[aria-label*="Breadcrumb"], .breadcrumb');
    for (const bc of breadcrumbs) {
      const text = bc.textContent?.toLowerCase() || '';
      if (text.includes('sko') || text.includes('shoes') || text.includes('sneakers') || 
          text.includes('boots') || text.includes('støvler') || text.includes('sandaler')) {
        return 'shoes';
      }
    }
    
    // Check product category badges/labels
    const categoryLabels = document.querySelectorAll('[data-testid*="category"], [class*="category"], [class*="product-type"]');
    for (const label of categoryLabels) {
      const text = label.textContent?.toLowerCase() || '';
      if (text.includes('sko') || text.includes('shoes') || text.includes('sneaker')) {
        return 'shoes';
      }
    }
    
    // Check page title or h1
    const title = document.title.toLowerCase();
    if (title.includes('sko') || h1Text.includes('sko') || 
        title.includes('sneaker') || h1Text.includes('sneaker') ||
        title.includes('boots') || h1Text.includes('støvl')) {
      return 'shoes';
    }
    
    // Look for shoe-specific size selectors (EU sizes like 36-48 without S/M/L)
    const sizeOptions = document.querySelectorAll('[data-testid*="size"] option, [data-testid*="size"] span');
    let hasShoeSize = false;
    for (const opt of sizeOptions) {
      const text = opt.textContent?.trim() || '';
      // Shoe sizes are typically 36-48 range, clothing is S/M/L or 32-42
      if (/^(3[6-9]|4[0-8])(\s|$|½)/.test(text)) {
        hasShoeSize = true;
        break;
      }
    }
    if (hasShoeSize) {
      return 'shoes';
    }
    
    console.log("PerFit: Could not detect category from page content");
    return null;
  } catch (error) {
    console.log("PerFit: Error in early category detection:", error);
    return null;
  }
}
