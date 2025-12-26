/**
 * Zalando Text Parser
 * 
 * Regex-based parsing of Zalando product text.
 * Extracts fit hints, model measurements, and material information.
 */

import { TextMeasurement } from './types';

/**
 * Extract Zalando's own size recommendation based on user's purchase history
 * Looks for text like "Anbefalt størrelse: 43" or "Din størrelse: M"
 */
export function extractZalandoRecommendation(): string | null {
  try {
    // Look for recommendation in common locations
    const selectors = [
      '[data-testid="pdp-recommended-size"]',
      '[data-testid="size-recommendation"]',
      '[class*="recommendation"]',
      '[class*="suggested-size"]',
      '.recommended-size'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || '';
        const sizeMatch = text.match(/(\d{2,3}(?:\s+\d+\/\d+)?|[XSML]{1,4})/i);
        if (sizeMatch) {
          console.log(`PerFit [Zalando]: ✅ Butikkens anbefaling funnet: ${sizeMatch[1]}`);
          return sizeMatch[1];
        }
      }
    }
    
    // Fallback: Search page text for recommendation patterns
    const patterns = [
      /(?:anbefalt|din|foreslått)\s*størrelse[:\s]+(\d{2,3}(?:\s+\d+\/\d+)?|[XSML]{1,4})/i,
      /(?:we recommend|recommended)\s*(?:size)?[:\s]+(\d{2,3}(?:\s+\d+\/\d+)?|[XSML]{1,4})/i,
      /størrelse[:\s]+(\d{2,3})\s*(?:passer|anbefales)/i
    ];
    
    const bodyText = document.body.textContent || '';
    for (const pattern of patterns) {
      const match = bodyText.match(pattern);
      if (match) {
        console.log(`PerFit [Zalando]: ✅ Butikkens anbefaling funnet (text): ${match[1]}`);
        return match[1];
      }
    }
    
    console.log("PerFit [Zalando]: Ingen butikk-anbefaling funnet");
    return null;
  } catch (error) {
    console.error("PerFit [Zalando]: Error extracting store recommendation:", error);
    return null;
  }
}

/**
 * Extract fit hint from Zalando page text
 * Looks for text like "Varen er liten" or "Varen er stor" with flexible regex matching
 * 
 * PRIORITY ORDER:
 * 1. Passform section (highest priority)
 * 2. Product description areas
 * 3. Body fallback (STRICT - must have context words very close to 'stor'/'liten')
 */
export function extractFitHint(): string | null {
  try {
    // 1. HØYESTE PRIORITET: Passform-seksjonen (accordion)
    const passformAccordion = document.querySelector('[data-testid="pdp-accordion-passform"]');
    if (passformAccordion) {
      const text = passformAccordion.textContent?.toLowerCase() || '';
      
      if (/(størrelsen|varen|modellen|anbefaler).*liten|liten.*(størrelsen|varen|størrelse|anbefal)/i.test(text)) {
        console.log(`PerFit [Zalando]: ✅ Fit hint detected (Passform section) - Item runs SMALL`);
        console.log(`PerFit [Zalando]: Funnet tekst: "${passformAccordion.textContent?.trim()}"`);
        return 'liten';
      }
      
      if (/(størrelsen|varen|modellen|anbefaler).*stor|stor.*(størrelsen|varen|størrelse|anbefal)/i.test(text)) {
        console.log(`PerFit [Zalando]: ✅ Fit hint detected (Passform section) - Item runs LARGE`);
        console.log(`PerFit [Zalando]: Funnet tekst: "${passformAccordion.textContent?.trim()}"`);
        return 'stor';
      }
    }
    
    // 2. SEKUNDÆR PRIORITET: Målrettede passform-elementer (klasse .HlZ_Tf)
    const passformElements = document.querySelectorAll('.HlZ_Tf, [class*="passform"], [class*="fit-hint"]');
    
    for (const element of passformElements) {
      const text = element.textContent?.toLowerCase() || '';
      
      if (/(størrelsen|varen|modellen|anbefaler).*liten|liten.*(størrelsen|varen|størrelse|anbefal)/i.test(text)) {
        console.log(`PerFit [Zalando]: ✅ Fit hint detected (fit element) - Item runs SMALL`);
        console.log(`PerFit [Zalando]: Funnet tekst: "${element.textContent?.trim()}"`);
        return 'liten';
      }
      
      if (/(størrelsen|varen|modellen|anbefaler).*stor|stor.*(størrelsen|varen|størrelse|anbefal)/i.test(text)) {
        console.log(`PerFit [Zalando]: ✅ Fit hint detected (fit element) - Item runs LARGE`);
        console.log(`PerFit [Zalando]: Funnet tekst: "${element.textContent?.trim()}"`);
        return 'stor';
      }
    }
    
    // 3. FALLBACK: Søk i hele document.body MED STRENG BEGRENSNING
    // Krever at 'stor'/'liten' står RETT ved siden av kontekstord (maks 15 tegn mellom)
    const bodyText = document.body.textContent?.toLowerCase() || '';
    
    // Streng regex: Maks 15 tegn mellom kontekstord og 'liten'
    if (/(størrelsen|varen|modellen|passform|anbefaler vi).{0,15}\bliten\b|\bliten\b.{0,15}(størrelsen|varen|størrelse|passform|anbefal)/i.test(bodyText)) {
      console.log("PerFit [Zalando]: ✅ Fit hint detected (body fallback - strict) - Item runs SMALL");
      return 'liten';
    }
    
    // Streng regex: Maks 15 tegn mellom kontekstord og 'stor'
    // Unngå 'stor' når det står alene uten passform-kontekst
    if (/(størrelsen|varen|modellen|passform|anbefaler vi).{0,15}\bstor\b|\bstor\b.{0,15}(størrelsen|varen|størrelse|passform|anbefal)/i.test(bodyText)) {
      console.log("PerFit [Zalando]: ✅ Fit hint detected (body fallback - strict) - Item runs LARGE");
      return 'stor';
    }
    
    console.log("PerFit [Zalando]: No specific fit hint found (true to size assumed)");
    return null;
  } catch (error) {
    console.error("PerFit [Zalando]: Error extracting fit hint:", error);
    return null;
  }
}

/**
 * Parse model measurements from product text
 * Extracts model height, size worn, and item length
 */
export function parseModelMeasurements(text: string): Partial<TextMeasurement> {
  const measurement: Partial<TextMeasurement> = { modelSize: '' };
  
  // UPGRADED REGEX: Extract model height with flexible pattern
  // Handles: "Modellhøyde: 187 cm", "Modellen er 189 cm", "Model: 185cm", etc.
  const heightMatch = text.match(/(?:Modell(?:høyde|en)?|Høyde|Model)[:\s]*(?:er)?[\s\w]*?(\d{3})\s*cm/i);
  if (heightMatch) {
    measurement.modelHeight = parseInt(heightMatch[1]);
    console.log(`PerFit [Zalando]: ✅ Model height extracted: ${measurement.modelHeight}cm`);
  } else {
    console.log("PerFit [Zalando]: No model height found in text (often not available)");
  }
  
  // UPGRADED REGEX: Extract model size with STRICT validation
  // Matches letters (S, M, L, XL) or numbers (48, 50) immediately after 'størrelse' or 'str'
  // Only accepts: S, M, L, XL, XXL, XXXL or numeric sizes (32, 48, 50)
  // REJECTS: LEG, FIT, TALL, and other non-size words
  const sizeMatch = text.match(/(?:størrelse|size|str\.?)\s*([A-Z]{1,4}|\d{2,3})(?:\s|\.|,|$)/i);
  if (sizeMatch) {
    const extractedSize = sizeMatch[1].toUpperCase();
    
    // Validate: Must be standard size (S/M/L/XL/XXL/XXXL) OR numeric (32, 48, etc.)
    const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const isValidSize = validSizes.includes(extractedSize) || /^\d{2,3}$/.test(extractedSize);
    
    // Reject common non-size words
    const invalidWords = ['LEG', 'FIT', 'TALL', 'SHORT', 'LANG', 'KORT', 'REGULAR', 'SLIM', 'WIDE'];
    const isInvalidWord = invalidWords.includes(extractedSize);
    
    if (isValidSize && !isInvalidWord) {
      measurement.modelSize = extractedSize;
      console.log(`PerFit [Zalando]: ✅ Model size extracted: ${measurement.modelSize}`);
    } else {
      console.warn(`PerFit [Zalando]: ⚠️ Rejected invalid size '${extractedSize}' - not a standard clothing size`);
      console.log(`PerFit [Zalando]: Valid sizes: ${validSizes.join(', ')}, or numeric (32-999)`);
    }
  } else {
    console.log("PerFit [Zalando]: ⚠️ Could not extract model size from text (will use fallback logic)");
  }
  
  // UPGRADED REGEX: Extract item length with flexible pattern
  // Handles: "Totallengde: 69 cm i størrelse M", "Length: 70cm size L", "Totallengde: 72 cm", etc.
  const lengthMatch = text.match(/(?:Total)?(?:lengde|length)[:\s]+(\d{2,3})\s*cm(?:\s+(?:i\s+)?(?:størrelse|size)\s+([A-Z0-9]{1,3}))?/i);
  if (lengthMatch) {
    measurement.itemLength = parseInt(lengthMatch[1]);
    // Size is optional - some products just say "Totallengde: 72 cm"
    if (lengthMatch[2]) {
      measurement.itemLengthSize = lengthMatch[2].toUpperCase();
      console.log(`PerFit [Zalando]: ✅ Item length extracted: ${measurement.itemLength}cm in size ${measurement.itemLengthSize}`);
    } else {
      console.log(`PerFit [Zalando]: ✅ Item length extracted: ${measurement.itemLength}cm (no specific size mentioned)`);
    }
  }
  
  // Detect ankle length items
  if (text.toLowerCase().includes('ankellengde') || text.toLowerCase().includes('ankle length')) {
    measurement.isAnkleLength = true;
    console.log("PerFit [Zalando]: ✅ Ankle length item detected");
  }
  
  return measurement;
}

/**
 * Detect moccasin/loafer construction from URL, title, and product details
 * Returns object with isMoccasin flag and material info
 */
export function detectMoccasinMaterial(): { isMoccasin: boolean; materialInfo: string } {
  console.log("PerFit [Zalando]: Søker etter mokkasin-konstruksjon og materiale...");
  
  let isMoccasin = false;
  let foundMaterialInfo = '';
  const allFoundKeywords: string[] = [];
  
  // STRATEGI 0: URL og Tittel-sjekk (raskeste)
  
  // URL-sjekk
  const url = window.location.href.toLowerCase();
  const urlKeywords = ['slippers', 'loafer', 'moccasin', 'mokkasiner'];
  for (const keyword of urlKeywords) {
    if (url.includes(keyword)) {
      isMoccasin = true;
      allFoundKeywords.push(`url:${keyword}`);
      console.log(`PerFit: Mokkasinsøm funnet i detaljer! (URL inneholder '${keyword}')`);
      break;
    }
  }
  
  // Tittel-sjekk (H1)
  const h1 = document.querySelector('h1');
  const productTitle = h1?.textContent?.toLowerCase() || '';
  const titleKeywords = ['slippers', 'loafer', 'mokkasiner'];
  for (const keyword of titleKeywords) {
    if (productTitle.includes(keyword)) {
      isMoccasin = true;
      allFoundKeywords.push(`title:${keyword}`);
      console.log(`PerFit: Mokkasinsøm funnet i detaljer! (Produkttittel inneholder '${keyword}')`);
      break;
    }
  }
  
  // BREDERE SØK: Finn produktdetaljer-seksjonen
  let productDetailsSection: Element | null = null;
  
  // Strategi 1: Spesifikke data-testid selektorer
  productDetailsSection = document.querySelector('[data-testid="pdp-accordion-productDetails"]') ||
                          document.querySelector('[data-testid="pdp-accordion-details"]') ||
                          document.querySelector('.dp_pdp_details');
  
  // Strategi 2: Søk etter elementer som INNEHOLDER teksten 'Produktdetaljer' eller 'Detaljer'
  if (!productDetailsSection) {
    console.log("PerFit [Zalando]: Standard selektorer feilet, søker etter tekst 'Produktdetaljer'...");
    const allElements = document.querySelectorAll('div, section, article, details');
    
    for (const element of allElements) {
      const heading = element.querySelector('h2, h3, h4, button, summary');
      const headingText = heading?.textContent?.toLowerCase() || '';
      
      if (headingText.includes('produktdetaljer') || headingText.includes('detaljer')) {
        productDetailsSection = element;
        console.log(`PerFit [Zalando]: ✅ Fant element med tekst '${heading?.textContent?.trim()}'`);
        break;
      }
    }
  }
  
  let detailListItems: NodeListOf<HTMLElement> | null = null;
  
  if (productDetailsSection) {
    // Finn alle listeelementer (li) i detalj-seksjonen
    detailListItems = productDetailsSection.querySelectorAll('li');
    console.log(`PerFit [Zalando]: ✅ Fant Produktdetaljer-seksjon med ${detailListItems.length} listeelementer`);
    console.log("PerFit [Zalando]: Analyserer tekstinnhold for konstruksjon og materiale...");
  } else {
    console.log("PerFit [Zalando]: ⚠️ Produktdetaljer ikke funnet med noen metode");
  }
  
  // NØKKELORD for mokkasiner/loafers (materiale som utvider seg)
  const moccasinKeywords = ['mokkasinsøm', 'mokkasiner', 'loafer'];
  const materialKeywords = ['semsket skinn', 'lær', 'skinn'];
  
  // STRATEGI 1: Skann listeelementer hvis tilgjengelig (mest presist)
  if (detailListItems && detailListItems.length > 0) {
    console.log("PerFit [Zalando]: Skanner listeelementer for nøkkelord...");
    
    detailListItems.forEach((li, index) => {
      const liText = li.textContent?.toLowerCase() || '';
      
      // Sjekk etter mokkasino-konstruksjon
      for (const keyword of moccasinKeywords) {
        if (liText.includes(keyword)) {
          isMoccasin = true;
          allFoundKeywords.push(keyword);
          console.log(`PerFit: Mokkasinsøm funnet i detaljer!`);
          console.log(`PerFit [Zalando]: ✅ Funnet '${keyword}' i listeelement #${index + 1}: "${li.textContent?.trim()}"`);
        }
      }
      
      // Sjekk etter materiale
      for (const keyword of materialKeywords) {
        if (liText.includes(keyword)) {
          if (!foundMaterialInfo) {
            foundMaterialInfo = keyword;
          }
          allFoundKeywords.push(keyword);
          // Hvis vi finner semsket skinn/lær, antar vi det er mokkasino
          if (!isMoccasin && (keyword === 'semsket skinn' || keyword === 'lær')) {
            isMoccasin = true;
          }
          console.log(`PerFit [Zalando]: ✅ Funnet materiale '${keyword}' i listeelement #${index + 1}: "${li.textContent?.trim()}"`);
        }
      }
    });
  } else {
    // STRATEGI 2: Fallback - søk i passform section text hvis tilgjengelig
    const passformSection = document.querySelector('[data-testid="pdp-accordion-passform"]');
    const detailsText = passformSection?.textContent?.toLowerCase() || '';
    
    if (detailsText) {
      console.log("PerFit [Zalando]: Ingen listeelementer funnet, bruker full tekst-søk i Passform...");
      
      // Sjekk etter mokkasino-type
      for (const keyword of moccasinKeywords) {
        if (detailsText.includes(keyword)) {
          isMoccasin = true;
          allFoundKeywords.push(keyword);
          console.log(`PerFit: Mokkasinsøm funnet i detaljer!`);
          console.log(`PerFit [Zalando]: ✅ Funnet '${keyword}' i produkttekst`);
        }
      }
      
      // Sjekk etter materiale (uavhengig av mokkasino-type)
      for (const keyword of materialKeywords) {
        if (detailsText.includes(keyword)) {
          foundMaterialInfo = keyword;
          allFoundKeywords.push(keyword);
          // Hvis vi finner semsket skinn/lær, antar vi det er mokkasino
          if (!isMoccasin && (keyword === 'semsket skinn' || keyword === 'lær')) {
            isMoccasin = true;
          }
        }
      }
    }
  }
  
  if (isMoccasin) {
    console.log(`PerFit [Zalando]: Detektert mokkasin-konstruksjon: true`);
    console.log(`PerFit [Zalando]: Materiale identifisert: ${foundMaterialInfo || allFoundKeywords.join(', ')}`);
  } else {
    console.log("PerFit [Zalando]: Detektert mokkasin-konstruksjon: false");
  }
  
  return {
    isMoccasin,
    materialInfo: foundMaterialInfo || allFoundKeywords.join(', ')
  };
}

/**
 * Scrape and parse text-based measurements from Zalando product page
 * Combines model measurements, fit hint, and moccasin detection
 */
export function scrapeTextMeasurements(): TextMeasurement | null {
  try {
    console.log("PerFit [Zalando]: Attempting text-based measurement extraction...");
    
    let text = '';
    
    // Strategy 1: Try Passform accordion (most specific)
    const passformSection = document.querySelector('[data-testid="pdp-accordion-passform"]');
    if (passformSection) {
      text = passformSection.textContent || '';
      console.log("PerFit [Zalando]: Found Passform section");
    }
    
    // Strategy 2: Fallback to broader product description area
    if (!text || text.length < 50) {
      console.log("PerFit [Zalando]: Passform section empty/missing, searching product details...");
      const productDetails = document.querySelector('[data-testid="pdp-product-description"]') ||
                            document.querySelector('.pdp-description') ||
                            document.querySelector('#product-detail');
      
      if (productDetails) {
        text = productDetails.textContent || '';
        console.log("PerFit [Zalando]: Using product details section");
      }
    }
    
    // Strategy 3: Last resort - search document body (first 2000 chars for performance)
    if (!text || text.length < 50) {
      console.log("PerFit [Zalando]: Searching entire page body (first 2000 chars)...");
      text = (document.body.innerText || document.body.textContent || '').substring(0, 2000);
    }
    
    // Log text sample for debugging
    const textSample = text.substring(0, 300).replace(/\s+/g, ' ');
    console.log("PerFit [Zalando]: Analyzing text for model info:", textSample);
    
    // Parse model measurements
    const measurement = parseModelMeasurements(text);
    
    // Extract fit hint
    const fitHint = extractFitHint();
    if (fitHint) {
      (measurement as any).fitHint = fitHint;
      const hintType = fitHint === 'liten' ? 'SMALL' : 'LARGE';
      console.log(`PerFit [Zalando]: ✅ Fit hint detected: ${hintType}`);
    }
    
    // Detect moccasin material
    const materialData = detectMoccasinMaterial();
    if (materialData.isMoccasin) {
      (measurement as any).isMoccasin = true;
      (measurement as any).materialInfo = materialData.materialInfo;
    }
    
    // Extract store's own recommendation (based on purchase history)
    const storeRecommendation = extractZalandoRecommendation();
    if (storeRecommendation) {
      (measurement as any).storeRecommendation = storeRecommendation;
      console.log(`PerFit [Zalando]: ✅ Butikkens anbefaling: ${storeRecommendation}`);
    }
    
    // CHANGED: No longer require modelSize - return if we have ANY useful data
    // This allows fallback logic in RecommendationEngine to use chest measurements
    const hasUsefulData = measurement.modelHeight || measurement.itemLength || measurement.modelSize;
    
    if (!hasUsefulData) {
      console.warn("PerFit [Zalando]: ❌ No useful measurement data found (no height, length, or size)");
      return null;
    }
    
    if (!measurement.modelSize) {
      console.log("PerFit [Zalando]: ⚠️ Model size missing, but returning other data (height/length) for fallback logic");
    }
    
    console.log("PerFit [Zalando]: ✅ Text measurement extraction complete:", measurement);
    return measurement as TextMeasurement;
  } catch (error) {
    console.error("PerFit [Zalando]: Error scraping text measurements:", error);
    return null;
  }
}
