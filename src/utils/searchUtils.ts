export const validatePostcode = (postcode: string) => {
  // Allow partial postcodes like "W14 9" or full postcodes
  const partialPostcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9]?[A-Z]{0,2}$/i;
  return partialPostcodeRegex.test(postcode.trim());
};

export const extractPostcode = (input: string) => {
  // Updated regex to match partial postcodes
  const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9]?[A-Z]{0,2})/i;
  const match = input.match(postcodeRegex);
  return match ? match[1] : null;
};

export const normalizeAddress = (addr: string) => {
  const original = addr;
  
  // Remove the postcode from the address for better matching
  const postcode = extractPostcode(addr);
  const addressWithoutPostcode = postcode ? addr.replace(postcode, '') : addr;
  
  const normalized = addressWithoutPostcode.toLowerCase()
    .replace(/[.,]/g, '')           
    .replace(/\b(flat|apartment)\b/i, '')  
    .replace(/\b(ground|first|second|third|fourth|fifth|top|basement)\s+floor\b/i, '') 
    .replace(/\b(left|right)\b/i, '') 
    .replace(/([a-z])([0-9])/i, '$1 $2') 
    .replace(/([0-9])([a-z])/i, '$1 $2') 
    .replace(/\s+/g, ' ')           
    .trim();                        

  console.log(`Address Normalization:
    Original: "${original}"
    Without Postcode: "${addressWithoutPostcode}"
    Normalized: "${normalized}"
    Steps:
    1. Remove postcode: "${addressWithoutPostcode}"
    2. Lowercase: "${addressWithoutPostcode.toLowerCase()}"
    3. After punctuation removal: "${addressWithoutPostcode.toLowerCase().replace(/[.,]/g, '')}"
    4. Final normalized: "${normalized}"`);

  return normalized;
};

export const findMatches = (properties: any[], searchAddress: string) => {
  const normalizedSearchAddress = normalizeAddress(searchAddress);
  
  console.log('Finding matches for:', {
    original: searchAddress,
    normalized: normalizedSearchAddress
  });

  const exactMatches = properties.filter(prop => {
    const normalizedPropAddress = normalizeAddress(prop.address);
    const isExactMatch = normalizedPropAddress === normalizedSearchAddress;
    
    console.log(`Checking property:
      Original: "${prop.address}"
      Normalized: "${normalizedPropAddress}"
      Exact Match: ${isExactMatch}`);
    
    return isExactMatch;
  });

  if (exactMatches.length > 0) {
    console.log('Found exact matches:', exactMatches.length);
    return { matches: exactMatches, type: 'exact' as const };
  }

  const partialMatches = properties.filter(prop => {
    const normalizedPropAddress = normalizeAddress(prop.address);
    const isPartialMatch = normalizedPropAddress.includes(normalizedSearchAddress) || 
                          normalizedSearchAddress.includes(normalizedPropAddress);
    
    console.log(`Checking for partial match:
      Property: "${normalizedPropAddress}"
      Search: "${normalizedSearchAddress}"
      Partial Match: ${isPartialMatch}`);
    
    return isPartialMatch;
  });

  console.log('Found partial matches:', partialMatches.length);
  return { matches: partialMatches, type: 'partial' as const };
};