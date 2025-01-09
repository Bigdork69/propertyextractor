export const validatePostcode = (postcode: string) => {
  const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
  return postcodeRegex.test(postcode.trim());
};

export const extractPostcode = (input: string) => {
  const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i;
  const match = input.match(postcodeRegex);
  return match ? match[1] : null;
};

export const normalizeAddress = (addr: string) => {
  return addr.toLowerCase()
    .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
    .replace(/[.,]/g, '')           // Remove periods and commas
    .replace(/\b(flat|apartment)\b/i, '')  // Remove flat/apartment
    .replace(/\b(ground|first|second|third|fourth|fifth|top|basement)\s+floor\b/i, '') // Remove floor descriptions
    .replace(/\b(left|right)\b/i, '') // Remove left/right descriptions
    .replace(/([a-z])([0-9])/i, '$1 $2') // Add space between letter and number (e.g., 18e -> 18 e)
    .replace(/([0-9])([a-z])/i, '$1 $2') // Add space between number and letter
    .replace(/\s+/g, ' ')           // Clean up any double spaces created
    .trim();                        // Remove leading/trailing spaces
};