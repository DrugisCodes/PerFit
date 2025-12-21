// Hjelpefunksjon for å vente litt (Zalando er tregt noen ganger)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Grensesnitt for rader i tabellen
interface SizeRow {
  intSize: string;
  chest: number;
  waist: number;
  hip: number;
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
  document.body.appendChild(alertBox);
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
    
    // Les tabelldata og vis anbefaling
    await readTableData(); 

  } else {
    console.error("PerFit: Kunne ikke finne 'Åpne størrelsestabell'-knappen.");
  }
  
  } catch (error) {
    console.error("PerFit: Feil ved åpning av størrelsestabell:", error);
  }
}

// Vent litt etter at siden lastes før vi starter, så Zalando får bygget ferdig siden sin.
setTimeout(() => {
  try {
    openSizeChart();
  } catch (error) {
    console.error("PerFit: Kritisk feil:", error);
  }
}, 3000);
