/**
 * Zalando Text Parser
 * 
 * Regex-based parsing of Zalando product text.
 * Extracts fit hints, model measurements, and material information.
 */

import { TextMeasurement } from './types';

/**
 * Universal text searcher - scans for keywords in container while filtering out noise
 * @param containerSelector - CSS selector for container to search in
 * @param keywords - Array of keywords/phrases to search for
 * @param excludeWords - Array of words/phrases to exclude (e.g., navigation links)
 * @returns Full text of first matching element, or null if not found
 */
function searchForText(
  containerSelector: string, 
  keywords: string[], 
  excludeWords: string[] = ['hopp til', 'hovedinnhold']
): string | null {
  const container = document.querySelector(containerSelector);
  if (!container) return null;

  // Skann alle avsnitt, lister og spenn
  const elements = container.querySelectorAll('p, span, li');
  
  for (const el of elements) {
    const text = el.textContent?.toLowerCase() || '';
    
    // Ignorer elementer med støy-ord
    if (excludeWords.some(word => text.includes(word))) continue;

    // Sjekk om teksten inneholder noen av våre nøkkelord
    if (keywords.some(keyword => text.includes(keyword))) {
      return text;
    }
  }
  return null;
}

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
 * 1. Passform section (pdp-accordion-passform)
 * 2. Product details section (pdp-accordion-productDetails)
 * 3. NO body fallback - only search in specific product sections
 */
/**
 * Detect product's fit type (Regular, Relaxed, Slim, etc.)
 * Used for intelligent size adjustment
 */
export function detectFitType(): string | undefined {
  try {
    // STRATEGI 1: Let i produktdetaljer etter tekst som inneholder "passform" eller "fit"
    const fitText = searchForText(
      '[data-testid="pdp-accordion-detaljer"], [data-testid="pdp-accordion-passform"]',
      ['passform', 'fit']
    );

    if (fitText) {
      console.log(`PerFit [Zalando]: 📋 Fant passform-tekst i accordion: "${fitText.substring(0, 60)}..."`);
      return analyzeFitText(fitText);
    }
    
    // FIKS: STRATEGI 2 - Deep Scrape av hele document.body hvis accordion er tom
    console.log('PerFit [Zalando]: Accordion tom, søker i hele document.body...');
    const bodyText = (document.body.textContent || '').toLowerCase();
    
    // Let etter eksplisitte mønstre: "Passform: Relaxed", "Fit: Relaxed", etc.
    const patterns = [
      /passform[:\s]+relaxed/i,
      /fit[:\s]+relaxed/i,
      /passform[:\s]+slim/i,
      /fit[:\s]+slim/i,
      /passform[:\s]+loose/i,
      /fit[:\s]+loose/i,
      /relaxed\s+fit/i,
      /slim\s+fit/i,
      /loose\s+fit/i
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(bodyText)) {
        const match = bodyText.match(pattern)?.[0] || '';
        console.log(`PerFit [Zalando]: ✅ Fant fit-type via deep scrape: "${match}"`);
        return analyzeFitText(match);
      }
    }
    
    console.log('PerFit [Zalando]: No fit type found anywhere, defaulting to Regular');
    return 'Regular';
  } catch (error) {
    console.error('PerFit [Zalando]: Error detecting fit type:', error);
    return undefined;
  }
}

/**
 * Analyserer fit-tekst og returnerer fit-type
 * Helper function for detectFitType
 */
function analyzeFitText(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Sjekk for Relaxed
  if (lowerText.includes('relaxed') || lowerText.includes('avslappet')) {
    console.log('PerFit [Zalando]: Fit type detected - Relaxed');
    return 'Relaxed';
  }
  
  // Sjekk for Slim
  if (lowerText.includes('slim') || lowerText.includes('smal')) {
    console.log('PerFit [Zalando]: Fit type detected - Slim');
    return 'Slim';
  }
  
  // Sjekk for Loose (behandles som Relaxed)
  if (lowerText.includes('loose') || lowerText.includes('løs')) {
    console.log('PerFit [Zalando]: Fit type detected - Loose (as Relaxed)');
    return 'Relaxed';
  }
  
  // Default hvis "passform" eller "fit" ble funnet uten spesifikk type
  console.log('PerFit [Zalando]: Fit type found but not specific - defaulting to Regular');
  return 'Regular';
}

export function extractFitHint(): string | null {
  try {
    // Sjekk accordion først (mest presis)
    const passformAccordion = document.querySelector('[data-testid="pdp-accordion-passform"]');
    const text = (passformAccordion?.textContent || '').toLowerCase();
    
    if (text.includes('liten')) {
      console.log(`PerFit [Zalando]: ✅ Fit hint detected (Passform section) - Item runs SMALL`);
      return 'liten';
    }
    if (text.includes('stor')) {
      console.log(`PerFit [Zalando]: ✅ Fit hint detected (Passform section) - Item runs LARGE`);
      return 'stor';
    }

    // Fallback til overskrifter/varsler nær størrelsesvelgeren
    const quickHint = document.querySelector('[class*="size-guide-info"]')?.textContent?.toLowerCase() || '';
    if (quickHint.includes('liten')) {
      console.log(`PerFit [Zalando]: ✅ Fit hint detected (size guide) - Item runs SMALL`);
      return 'liten';
    }
    if (quickHint.includes('stor')) {
      console.log(`PerFit [Zalando]: ✅ Fit hint detected (size guide) - Item runs LARGE`);
      return 'stor';
    }

    console.log("PerFit [Zalando]: Ingen spesifikk fit-hint funnet");
    return null;
  } catch (error) {
    console.error("PerFit [Zalando]: Error extracting fit hint:", error);
    return null;
  }
}

/**
 * Extract brand's size suggestion from gray hint box near size picker
 * Looks for critical warnings like "Størrelsen er liten - vi anbefaler å gå opp en størrelse"
 * @returns +1 if should size up, -1 if should size down, 0 if no suggestion
 */
export function extractBrandSizeSuggestion(): number {
  try {
    // FIKS: Bruk querySelectorAll for å finne ALLE varslingsbokser
    const alertBoxes = document.querySelectorAll('p.HlZ_Tf, .voFjEy');
    
    if (alertBoxes.length === 0) {
      console.log('PerFit [Zalando]: Ingen varslingsbokser funnet (HlZ_Tf/voFjEy)');
      return 0;
    }

    console.log(`PerFit [Zalando]: Fant ${alertBoxes.length} varslingsbokser, looper gjennom alle...`);

    // Loop gjennom ALLE treff - ignorer "Hopp til" men fortsett til vi finner "størrelsen er"
    for (let i = 0; i < alertBoxes.length; i++) {
      const alertBox = alertBoxes[i];
      const alertText = (alertBox.textContent || '').toLowerCase();
      
      // Ignorer navigasjonslinker, men FORTSETT å lete
      if (alertText.includes('hopp til') || alertText.includes('hovedinnhold')) {
        console.log(`PerFit [Zalando]: Element ${i + 1}/${alertBoxes.length} ignorert (navigasjonslink): "${alertText.substring(0, 40)}"`);
        continue; // GÅ TIL NESTE ELEMENT
      }

      console.log(`PerFit [Zalando]: ✅ Analyserer element ${i + 1}/${alertBoxes.length}: "${alertText.substring(0, 80)}"`);

      // Sjekk for "stor" + "ned" = Size DOWN (-1) - støtter både "størrelsen" og "varen"
      const isLarge = /(størrelsen|varen) er (stor|large)|gå ned en størrelse/i.test(alertText);
      if (isLarge) {
        console.log('PerFit [Zalando]: ⚠️ BRAND SUGGESTION FUNNET: Size runs LARGE (-1)');
        return -1;
      }

      // Sjekk for "liten" + "opp" = Size UP (+1) - støtter både "størrelsen" og "varen"
      const isSmall = /(størrelsen|varen) er (liten|small)|gå opp en størrelse/i.test(alertText);
      if (isSmall) {
        console.log('PerFit [Zalando]: ⚠️ BRAND SUGGESTION FUNNET: Size runs SMALL (+1)');
        return 1;
      }
    }

    console.log('PerFit [Zalando]: Varslingsbokser funnet, men ingen størrelsesanbefaling detektert');
    return 0;
  } catch (error) {
    console.error('PerFit [Zalando]: Error extracting brand size suggestion:', error);
    return 0;
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
  
  // INSEAM EXTRACTION: Extract inside leg length for pants
  // Handles: "Lengde innside ben: 78 cm i størrelse 33x32", "Inside leg: 80cm size M", etc.
  const inseamMatch = text.match(/(?:Lengde\s+innside\s+ben|Inside\s+leg|Inseam)[:\s]+(\d{2,3})\s*cm(?:\s+(?:i\s+)?(?:størrelse|size)\s+([A-Z0-9x×/\-]+))?/i);
  if (inseamMatch) {
    measurement.inseamLength = parseInt(inseamMatch[1]);
    if (inseamMatch[2]) {
      measurement.inseamLengthSize = inseamMatch[2].toUpperCase();
      console.log(`PerFit [Zalando]: ✅ Inseam length extracted: ${measurement.inseamLength}cm in size ${measurement.inseamLengthSize}`);
      
      // FALLBACK: Hvis modelSize ikke ble funnet tidligere, bruk inseam size
      if (!measurement.modelSize && measurement.inseamLengthSize) {
        // Ekstraher bokstavstørrelse fra inseamLengthSize (f.eks. "M" fra "32x30" eller bare "M")
        const sizeFromInseam = measurement.inseamLengthSize.match(/^([A-Z]+)$/i)?.[1];
        if (sizeFromInseam) {
          const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
          if (validSizes.includes(sizeFromInseam.toUpperCase())) {
            measurement.modelSize = sizeFromInseam.toUpperCase();
            console.log(`PerFit [Zalando]: 🔄 Fant modellstørrelse (${measurement.modelSize}) via inseam-detaljer (fallback)`);
          }
        }
      }
    } else {
      console.log(`PerFit [Zalando]: ✅ Inseam length extracted: ${measurement.inseamLength}cm (no specific size mentioned)`);
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
 * Extract the size worn by the model from product details
 * Searches for patterns like "Modellen bruker str. 31" or "Model wears size M"
 * @returns Model's size as string, or null if not found
 */
export function extractModelSize(): string | null {
  try {
    const detailsAccordion = document.querySelector('[data-testid="pdp-accordion-detaljer"]');
    const passformAccordion = document.querySelector('[data-testid="pdp-accordion-passform"]');
    
    const detailsText = (detailsAccordion?.textContent || '').toLowerCase();
    const passformText = (passformAccordion?.textContent || '').toLowerCase();
    const combinedText = detailsText + ' ' + passformText;
    
    // Norwegian patterns: "Modellen bruker str. 31", "Modellen har på seg 32"
    const norwegianPattern = /modell(?:en)?\s+(?:bruker|har på seg|brukar)\s+(?:str\.?|størrelse)?\s*([0-9]{2}|[A-Z]{1,3})/i;
    // English patterns: "Model wears size M", "Model is wearing 32"
    const englishPattern = /model\s+(?:wears|is wearing)\s+(?:size)?\s*([0-9]{2}|[A-Z]{1,3})/i;
    
    const norwegianMatch = combinedText.match(norwegianPattern);
    const englishMatch = combinedText.match(englishPattern);
    
    const match = norwegianMatch || englishMatch;
    if (match) {
      const modelSize = match[1].toUpperCase();
      console.log(`PerFit [Zalando]: ✅ Model size extracted: ${modelSize}`);
      return modelSize;
    }
    
    console.log('PerFit [Zalando]: No model size found in product details');
    return null;
  } catch (error) {
    console.error('PerFit [Zalando]: Error extracting model size:', error);
    return null;
  }
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
    if (passformSection && passformSection.textContent && passformSection.textContent.length > 30) {
      text = passformSection.textContent;
      console.log("PerFit [Zalando]: Found Passform section");
    }

    // Strategy 2: Fallback to broader product description area
    if (!text || text.length < 50) {
      console.log("PerFit [Zalando]: Passform section empty/missing, searching product details...");
      const productDetails = document.querySelector('[data-testid="pdp-product-description"]') ||
                            document.querySelector('.pdp-description') ||
                            document.querySelector('#product-detail');
      if (productDetails && productDetails.textContent && productDetails.textContent.length > 30) {
        text = productDetails.textContent;
        console.log("PerFit [Zalando]: Using product details section");
      }
    }

    // NEW: Try [data-testid="pdp-description"] or [class*="product-description"] if still no text
    if (!text || text.length < 50) {
      // Vi søker spesifikt i PDP-beskrivelsen, ikke hele bodyen
      const pdpDesc = document.querySelector('[data-testid="pdp-description"]') || 
                      document.querySelector('.h-container') ||
                      document.querySelector('#product-description');
      if (pdpDesc) {
        text = pdpDesc.textContent || '';
        console.log("PerFit [Zalando]: ✅ Fant modell-info i PDP-beskrivelsen");
      }
    }
    // Sjekk etter .HlZ_Tf for inseam-info hvis fortsatt ikke funnet
    if ((!text || text.length < 50)) {
      const inseamElement = document.querySelector('.HlZ_Tf');
      if (inseamElement) {
        text = document.body.innerText.substring(0, 3000);
        console.log("PerFit [Zalando]: ✅ Fant inseam-info via spesifikk klasse");
      }
    }
    
    // Strategy 3: Last resort - body fallback er fjernet for å unngå falske treff
    // if (!text || text.length < 50) {
    //   console.log("PerFit [Zalando]: Searching entire page body (first 2000 chars)...");
    //   text = (document.body.innerText || document.body.textContent || '').substring(0, 2000);
    // }
    
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
