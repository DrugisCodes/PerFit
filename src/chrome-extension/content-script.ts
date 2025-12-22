// Hjelpefunksjon for å vente litt (Zalando er tregt noen ganger)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Grensesnitt for rader i tabellen
interface SizeRow {
  intSize: string;
  chest: number;
  waist: number;
  hip: number;
  footLength?: number;
  rowIndex?: number;
}

// Grensesnitt for skostørrelser
interface ShoeSize {
  size: string;
  footLength: number;
  isInterpolated: boolean;
}

// Beregn buffer (ekstra cm) basert på fit preference
const getBufferInCm = (preference: number): number => {
  const buffers: Record<number, number> = {
    1: 0,  // Tight: Sitter helt inntil huden
    2: 2,  // Tight: Minimal ease
    3: 3,  // Fitted: Viser kroppsform
    4: 5,  // Fitted: Nær kroppen, komfortabel
    5: 6,  // Regular: Standard passform (default)
    6: 9,  // Regular: Standard komfort
    7: 10, // Loose: Avslappet stil
    8: 14, // Loose: Merkbart romslig
    9: 16, // Oversized: Baggy stil
    10: 20 // Oversized: Veldig baggy
  };
  return buffers[preference] || 6; // Default til Regular (6cm)
};

// Hjelpefunksjon for å finne elementer basert på tekst (Vår hemmelige våpen!)
function findElementByText(tag: string, text: string): HTMLElement | null {
  const xpath = `//${tag}[contains(text(), '${text}')]`;
  const result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  return result.singleNodeValue as HTMLElement;
}

/**
 * Skrap alle tilgjengelige størrelser fra 'Velg størrelse' dropdown
 */
function scrapeDropdownSizes(): string[] {
  try {
    const dropdownSizes: string[] = [];
    
    // Finn størrelsesvelger-knapper
    const sizeButtons = document.querySelectorAll('[data-testid*="size"], [class*="size"], button[aria-label*="størrelse"]');
    
    sizeButtons.forEach(button => {
      const sizeText = button.textContent?.trim();
      if (sizeText && /^\d+/.test(sizeText)) {
        dropdownSizes.push(sizeText);
      }
    });

    // Sjekk også select-elementer
    const selectElements = document.querySelectorAll('select');
    selectElements.forEach(select => {
      const options = select.querySelectorAll('option');
      options.forEach(option => {
        const value = option.value.trim();
        const text = option.textContent?.trim();
        if (value && /^\d+/.test(value)) {
          dropdownSizes.push(value);
        } else if (text && /^\d+/.test(text)) {
          dropdownSizes.push(text);
        }
      });
    });

    const uniqueSizes = Array.from(new Set(dropdownSizes)).sort((a, b) => {
      const aNum = parseFloat(a.replace(',', '.'));
      const bNum = parseFloat(b.replace(',', '.'));
      return aNum - bNum;
    });

    console.log(`PerFit: Fant ${uniqueSizes.length} størrelser i dropdown:`, uniqueSizes);
    return uniqueSizes;
  } catch (error) {
    console.error("PerFit: Feil ved skraping av dropdown-størrelser:", error);
    return [];
  }
}

/**
 * Rens skostørrelse-streng for å håndtere halvstørrelser
 * Konverterer "43 1/3" til "43.33", "43.5" forblir "43.5"
 */
function cleanShoeSize(sizeStr: string): string {
  sizeStr = sizeStr.trim();
  
  // Håndter brøker som "43 1/3"
  const fractionMatch = sizeStr.match(/(\d+)\s+(\d+)\/(\d+)/);
  if (fractionMatch) {
    const whole = parseInt(fractionMatch[1]);
    const numerator = parseInt(fractionMatch[2]);
    const denominator = parseInt(fractionMatch[3]);
    const decimal = (whole + numerator / denominator).toFixed(2);
    return decimal;
  }
  
  // Erstatt komma med punktum
  return sizeStr.replace(',', '.');
}

/**
 * Interpoler fotlengde for mellomstørrelser
 * 
 * Eksempel: Hvis tabellen viser:
 * - 43 → 27.0cm
 * - 44 → 27.7cm
 * 
 * Og dropdown har 43 1/3, beregn:
 * 43 1/3 ≈ 27.0 + (27.7 - 27.0) * (1/3) = 27.23cm
 */
function interpolateFootLength(size: string, tableSizes: ShoeSize[]): number | null {
  const sizeNum = parseFloat(size.replace(',', '.').replace(/\s+/g, ''));
  
  if (isNaN(sizeNum) || tableSizes.length < 2) {
    return null;
  }

  // Finn de to omkringliggende helstørrelsene i tabellen
  let lowerSize: ShoeSize | null = null;
  let upperSize: ShoeSize | null = null;

  for (let i = 0; i < tableSizes.length - 1; i++) {
    const currentNum = parseFloat(tableSizes[i].size.replace(',', '.'));
    const nextNum = parseFloat(tableSizes[i + 1].size.replace(',', '.'));
    
    if (currentNum <= sizeNum && sizeNum <= nextNum) {
      lowerSize = tableSizes[i];
      upperSize = tableSizes[i + 1];
      break;
    }
  }

  if (!lowerSize || !upperSize) {
    return null;
  }

  // Lineær interpolering
  const lowerNum = parseFloat(lowerSize.size.replace(',', '.'));
  const upperNum = parseFloat(upperSize.size.replace(',', '.'));
  const ratio = (sizeNum - lowerNum) / (upperNum - lowerNum);
  const interpolated = lowerSize.footLength + (upperSize.footLength - lowerSize.footLength) * ratio;
  
  console.log(`PerFit: Interpolerte størrelse ${size} → ${interpolated.toFixed(2)}cm (mellom ${lowerSize.size}=${lowerSize.footLength}cm og ${upperSize.size}=${upperSize.footLength}cm)`);
  
  return Math.round(interpolated * 100) / 100; // Rund til 2 desimaler
}

/**
 * Finn fit hint fra Zalando-siden
 * Ser etter tekst som "Varen er liten" eller "Varen er stor"
 */
function extractFitHint(): string | null {
  try {
    const pageText = document.body.textContent || '';
    
    if (pageText.includes('Varen er liten') || pageText.includes('liten i størrelsen')) {
      console.log("PerFit: Fit hint oppdaget - Varen er LITEN");
      return 'liten';
    }
    
    if (pageText.includes('Varen er stor') || pageText.includes('stor i størrelsen')) {
      console.log("PerFit: Fit hint oppdaget - Varen er STOR");
      return 'stor';
    }
    
    console.log("PerFit: Ingen spesiell fit hint funnet (sann til størrelse antatt)");
    return null;
  } catch (error) {
    console.error("PerFit: Feil ved henting av fit hint:", error);
    return null;
  }
}

/**
 * Beregn beste skostørrelse med smart interpolering
 * 
 * Logikk:
 * 1. Bruk brukerens fotlengde (27.0cm)
 * 2. Legg til 0.2cm buffer hvis varen er "liten"
 * 3. Finn størrelsen med minste absolutte forskjell til målet
 * 4. Støtter mellomstørrelser gjennom interpolering
 */
function calculateSmartShoeSize(
  userFootLength: number,
  tableShoeSizes: ShoeSize[],
  dropdownSizes: string[],
  fitHint: string | null
): { size: string; footLength: number; diff: number } | null {
  
  console.log(`PerFit [SHOES]: Brukerens fotlengde: ${userFootLength}cm`);
  console.log(`PerFit [SHOES]: Fit hint: ${fitHint || 'ingen'}`);
  
  // Legg til buffer hvis varen er liten
  const buffer = (fitHint && fitHint.toLowerCase().includes('liten')) ? 0.2 : 0;
  const targetFootLength = userFootLength + buffer;
  
  if (buffer > 0) {
    console.log(`PerFit [SHOES]: Varen merket som 'liten', legger til ${buffer}cm buffer → mål: ${targetFootLength}cm`);
  }
  
  // Bygg komplett liste med størrelser (tabell + interpolerte)
  const allSizes: ShoeSize[] = [...tableShoeSizes];
  
  if (dropdownSizes.length > 0) {
    console.log("PerFit [SHOES]: Sjekker for mellomstørrelser å interpolere...");
    
    dropdownSizes.forEach(dropdownSize => {
      const cleanDropdownSize = cleanShoeSize(dropdownSize);
      const alreadyInTable = tableShoeSizes.some(s => s.size === cleanDropdownSize);
      
      if (!alreadyInTable) {
        const interpolatedLength = interpolateFootLength(cleanDropdownSize, tableShoeSizes);
        
        if (interpolatedLength) {
          allSizes.push({
            size: cleanDropdownSize,
            footLength: interpolatedLength,
            isInterpolated: true
          });
          console.log(`PerFit [SHOES]: ✨ Lagt til interpolert størrelse ${cleanDropdownSize} med fotlengde ${interpolatedLength}cm`);
        }
      }
    });
    
    // Sorter etter størrelsesnummer
    allSizes.sort((a, b) => {
      const aNum = parseFloat(a.size.replace(',', '.'));
      const bNum = parseFloat(b.size.replace(',', '.'));
      return aNum - bNum;
    });
  }
  
  console.log(`PerFit [SHOES]: Totalt ${allSizes.length} størrelser tilgjengelig (${allSizes.filter(s => s.isInterpolated).length} interpolert)`);
  
  // Finn størrelsen med minste absolutte forskjell
  let bestMatch: ShoeSize | null = null;
  let smallestDiff = Infinity;
  
  for (const shoeSize of allSizes) {
    const diff = Math.abs(shoeSize.footLength - targetFootLength);
    console.log(`PerFit [SHOES]: Størrelse ${shoeSize.size} (${shoeSize.footLength}cm) - diff: ${diff.toFixed(2)}cm ${shoeSize.isInterpolated ? '[interpolert]' : ''}`);
    
    if (diff < smallestDiff) {
      smallestDiff = diff;
      bestMatch = shoeSize;
    }
  }
  
  if (bestMatch) {
    console.log(`PerFit [SHOES]: ✅ Beste match - Størrelse ${bestMatch.size} (${bestMatch.footLength}cm, diff: ${smallestDiff.toFixed(2)}cm)`);
    return {
      size: bestMatch.size,
      footLength: bestMatch.footLength,
      diff: smallestDiff
    };
  }
  
  console.error("PerFit [SHOES]: Ingen match funnet");
  return null;
}

/**
 * Les skostørrelse-tabell fra Zalando
 * Skraper fotlengde-data og bruker smart matchingslogikk
 */
async function readShoeTableData() {
  console.log("PerFit [SHOES]: Begynner å lese skostørrelse-tabellen...");

  try {
    // 1. Finn skostørrelse-tabell (ser etter "Fotlengde" eller "Skostørrelse")
    const tables = document.querySelectorAll('table');
    let shoeTable: HTMLTableElement | undefined;

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i] as HTMLTableElement;
      const tableText = table.textContent || '';
      
      if (tableText.includes("Fotlengde") || tableText.includes("Skostørrelse")) {
        shoeTable = table;
        console.log(`PerFit [SHOES]: Fant skostørrelse-tabell (tabell ${i + 1}/${tables.length})`);
        break;
      }
    }

    if (!shoeTable) {
      console.error("PerFit [SHOES]: Fant ikke skostørrelse-tabell");
      return;
    }

    // 2. Hent brukerens profil
    if (typeof chrome === "undefined" || !chrome.storage) {
      console.error("PerFit: Chrome API not available");
      return;
    }

    const result = await chrome.storage.local.get(["userProfile"]);
    
    if (chrome.runtime.lastError) {
      console.error("PerFit: Storage error:", chrome.runtime.lastError);
      return;
    }

    const user = result.userProfile;

    if (!user || typeof user !== "object") {
      console.log("PerFit: Ingen profil funnet. Kan ikke sammenligne.");
      return;
    }

    // Valider fotlengde
    const userFootLength = user.footLength ? parseFloat(user.footLength) : null;
    if (!userFootLength || isNaN(userFootLength) || userFootLength <= 0) {
      console.error("PerFit [SHOES]: Ugyldig fotlengde i profil:", user.footLength);
      return;
    }

    // 3. Les tabellhoder for å finne kolonner
    const headerCells = shoeTable.querySelectorAll('thead th');
    const headers: string[] = [];
    headerCells.forEach(th => {
      headers.push(th.textContent?.trim().toLowerCase() || '');
    });

    console.log("PerFit [SHOES]: Tabellhoder:", headers);

    // Finn kolonne-indekser
    let euSizeIndex = -1;
    let footLengthIndex = -1;
    let isFootLengthInMm = false;

    headers.forEach((header, index) => {
      if (header === 'eu' || header === 'eur' || header.includes('størrelse')) {
        euSizeIndex = index;
        console.log(`PerFit [SHOES]: Fant EU/Størrelse kolonne ved indeks ${index}`);
      } else if (header.includes('fotlengde') || header.includes('foot length') || header.includes('cm') || header.includes('mm')) {
        footLengthIndex = index;
        isFootLengthInMm = header.includes('mm') || header.includes('(mm)');
        console.log(`PerFit [SHOES]: Fant fotlengde kolonne ved indeks ${index}, enhet: ${isFootLengthInMm ? 'mm' : 'cm'}`);
      }
    });

    if (euSizeIndex === -1 || footLengthIndex === -1) {
      console.error("PerFit [SHOES]: Kunne ikke finne nødvendige kolonner");
      return;
    }

    // 4. Les tabell-rader
    const rows = shoeTable.querySelectorAll('tbody tr');
    const tableShoeSizes: ShoeSize[] = [];

    rows.forEach((row: Element, rowIndex: number) => {
      const cells = row.querySelectorAll('td');
      
      if (cells.length > Math.max(euSizeIndex, footLengthIndex)) {
        const euSizeRaw = cells[euSizeIndex].textContent?.trim() || "";
        const euSize = cleanShoeSize(euSizeRaw);
        
        const footLengthRaw = cells[footLengthIndex].textContent?.trim() || "0";
        const footLengthValue = parseFloat(footLengthRaw.replace(',', '.'));
        
        // Konverter til cm hvis tabellen bruker mm
        let footLengthCm = isFootLengthInMm ? footLengthValue / 10 : footLengthValue;
        footLengthCm = Math.round(footLengthCm * 100) / 100; // Rund til 2 desimaler

        if (euSize && footLengthCm > 0) {
          tableShoeSizes.push({
            size: euSize,
            footLength: footLengthCm,
            isInterpolated: false
          });
          console.log(`PerFit [SHOES]: Rad ${rowIndex} - EU: ${euSize}, Fotlengde: ${footLengthCm}cm`);
        }
      }
    });

    console.log(`PerFit [SHOES]: Skrapte ${tableShoeSizes.length} skostørrelser fra tabell`);

    if (tableShoeSizes.length === 0) {
      console.error("PerFit [SHOES]: Ingen gyldig skostørrelse-data funnet");
      return;
    }

    // 5. Skrap dropdown-størrelser
    const dropdownSizes = scrapeDropdownSizes();

    // 6. Hent fit hint
    const fitHint = extractFitHint();

    // 7. Beregn beste størrelse
    const recommendation = calculateSmartShoeSize(
      userFootLength,
      tableShoeSizes,
      dropdownSizes,
      fitHint
    );

    if (!recommendation) {
      console.error("PerFit [SHOES]: Kunne ikke beregne anbefaling");
      return;
    }

    console.log(`PerFit [SHOES]: ✅ Anbefaling klar: Størrelse ${recommendation.size}`);
    
    // 8. Vis anbefalingen
    showRecommendationOnPage(`${recommendation.size} (Fotlengde: ${recommendation.footLength}cm, Diff: ${recommendation.diff.toFixed(2)}cm)`);
    
  } catch (error) {
    console.error("PerFit [SHOES]: Feil ved lesing av skostørrelse-data:", error);
  }
}

async function readTableData() {
  console.log("PerFit: Begynner å lese kroppsmål-tabellen...");

  try {
    // 1. Finn riktig tabell basert på overskriften "Kroppsmål"
    const tables = document.querySelectorAll('table');
    let bodyMeasureTable: HTMLTableElement | undefined;

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i] as HTMLTableElement;
      if (table.textContent?.includes("Kroppsmål")) {
        bodyMeasureTable = table;
        break;
      }
    }

    if (!bodyMeasureTable) {
      console.error("PerFit: Fant ikke tabellen for Kroppsmål.");
      return;
    }

    // 2. Hent brukerens profil fra lagring med validering
    if (typeof chrome === "undefined" || !chrome.storage) {
      console.error("PerFit: Chrome API not available");
      return;
    }

    const result = await chrome.storage.local.get(["userProfile"]);
    
    if (chrome.runtime.lastError) {
      console.error("PerFit: Storage error:", chrome.runtime.lastError);
      return;
    }

    const user = result.userProfile;

    if (!user || typeof user !== "object") {
      console.log("PerFit: Ingen profil funnet. Kan ikke sammenligne.");
      return;
    }

    // Validate chest measurement exists and is valid
    const userChest = parseInt(user.chest);
    if (!user.chest || isNaN(userChest) || userChest <= 0) {
      console.error("PerFit: Ugyldig brystmål i profil:", user.chest);
      return;
    }

    // 3. Gå gjennom alle rader i tabellen (unntatt overskriften)
    const rows = bodyMeasureTable.querySelectorAll('tbody tr');
    const sizeData: SizeRow[] = [];

    rows.forEach((row: Element) => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 5) {
      const chestValue = parseInt(cells[2].textContent?.trim() || "0");
      const waistValue = parseInt(cells[3].textContent?.trim() || "0");
      const hipValue = parseInt(cells[4].textContent?.trim() || "0");
      
      // Only add rows with valid numeric data
      if (chestValue > 0) {
        sizeData.push({
          intSize: cells[1].textContent?.trim() || "",
          chest: chestValue,
          waist: waistValue,
          hip: hipValue
        });
      }
    }
  });

  if (sizeData.length === 0) {
    console.error("PerFit: Ingen gyldig størrelsesdata funnet i tabellen");
    return;
  }

  console.log("PerFit: Tabelldata hentet:", sizeData);

  // 4. Beregn målbildet med fit preference (validert tidligere)
  const fitPreference = typeof user.fitPreference === "number" && user.fitPreference >= 1 && user.fitPreference <= 10
    ? user.fitPreference 
    : 5; // Default til Regular (5)
  const bufferCm = getBufferInCm(fitPreference);
  const targetChestWidth = userChest + bufferCm;

  console.log(`PerFit: Ditt bryst (${userChest}cm) + Passform-buffer (${bufferCm}cm) = Mål for plagg: ${targetChestWidth}cm`);
  
  // 5. Finn den beste matchen
  let recommendedSize = "Ukjent";
  
  for (const size of sizeData) {
    // Finn den første størrelsen i tabellen som er stor nok for ditt 'target'
    if (size.chest >= targetChestWidth) {
      recommendedSize = size.intSize;
      console.log(`PerFit: Funnet størrelse ${recommendedSize} (brystvidde ${size.chest}cm >= ${targetChestWidth}cm)`);
      break; 
    }
  }

  if (recommendedSize === "Ukjent") {
    console.log("PerFit: Ingen størrelse i tabellen er stor nok. Vurder største tilgjengelige størrelse.");
  }

  console.log(`PerFit Anbefaling: Basert på brystmål (${userChest}cm) + passform (${bufferCm}cm buffer), anbefaler vi størrelse ${recommendedSize}`);
  
  // 6. Vis anbefalingen til brukeren (Injiser i DOM)
  showRecommendationOnPage(recommendedSize);
  
  } catch (error) {
    console.error("PerFit: Feil ved lesing av tabelldata:", error);
  }
}

function showRecommendationOnPage(size: string) {
  // Lag et lite element som viser anbefalingen
  const alertBox = document.createElement('div');
  alertBox.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #2563eb;
    color: white;
    padding: 15px;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 10000;
    font-family: sans-serif;
  `;
  alertBox.innerHTML = `<strong>PerFit Anbefaling:</strong> Vi tror <strong>${size}</strong> passer deg best!`;
  document.documentElement.appendChild(alertBox);
}

async function openSizeChart() {
  console.log("PerFit: Starter forsøk på å åpne størrelsestabellen...");

  try {
    // --- STEG A: Finn og klikk "Passform" ---
    // Noen ganger er "Passform" allerede åpen. Vi prøver å finne den.
    const passformSpan = findElementByText("span", "Passform");

    if (passformSpan) {
      // Vi må ofte klikke på knappen RUNDT teksten, ikke selve teksten.
      const clickTarget = passformSpan.closest("button") || passformSpan;
      
      // Sjekk om den allerede er åpen (Zalando bruker ofte 'aria-expanded="true"')
    const isExpanded = clickTarget.getAttribute("aria-expanded") === "true";
    
    if (!isExpanded) {
        console.log("PerFit: Klikker på 'Passform'...");
        clickTarget.click();
        // Vent på at menyen sklir ned
        await delay(1500);
    } else {
        console.log("PerFit: 'Passform' var allerede åpen.");
    }
  }

  // --- STEG B: Finn og klikk "Åpne størrelsestabell" ---
  const openTableSpan = findElementByText("span", "Åpne størrelsestabell");

  if (openTableSpan) {
    console.log("PerFit: Fant knappen, åpner tabellen...");
    // Igjen, finn nærmeste klikkbare element rundt teksten
    const clickTarget = openTableSpan.closest("button") || openTableSpan;
    clickTarget.click();
    
    // Vent på at det store vinduet (modalen) åpner seg
    await delay(2500);
    console.log("PerFit: Tabellen skal være åpen nå! Klar til å lese data.");
    
    // Detekter type tabell (sko vs klær)
    const allTables = document.querySelectorAll('table');
    let isShoeTable = false;
    
    for (const table of allTables) {
      const tableText = table.textContent || '';
      if (tableText.includes("Fotlengde") || tableText.includes("Skostørrelse")) {
        isShoeTable = true;
        break;
      }
    }
    
    // Les riktig type tabelldata
    if (isShoeTable) {
      console.log("PerFit: Oppdaget skostørrelse-tabell");
      await readShoeTableData();
    } else {
      console.log("PerFit: Oppdaget klær-tabell");
      await readTableData();
    }

  } else {
    console.error("PerFit: Kunne ikke finne 'Åpne størrelsestabell'-knappen.");
  }
  
  } catch (error) {
    console.error("PerFit: Feil ved åpning av størrelsestabell:", error);
  }
}

// Start immediately - using documentElement prevents React hydration conflicts
try {
  openSizeChart();
} catch (error) {
  console.error("PerFit: Kritisk feil:", error);
}
