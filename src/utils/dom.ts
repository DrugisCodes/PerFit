/**
 * DOM Utility Functions
 * 
 * Common DOM manipulation and query helpers used across the extension
 */

/**
 * Helper function to wait/delay execution
 * Useful for waiting for page elements to load or animations to complete
 * 
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the delay
 */
export const delay = (ms: number): Promise<void> => 
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Find DOM elements by text content using XPath
 * This is more robust than class-based selectors that can change
 * 
 * @param tag - HTML tag name to search for (e.g., 'span', 'button', 'div')
 * @param text - Text content to search for (case-sensitive, uses contains)
 * @returns The first matching HTMLElement or null if not found
 * 
 * @example
 * const button = findElementByText('button', 'Add to cart');
 * if (button) button.click();
 */
export function findElementByText(tag: string, text: string): HTMLElement | null {
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
