import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const extractPostcode = (input: string): string | null => {
  const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i;
  const match = input.match(postcodeRegex);
  return match ? match[1].trim() : null;
};

const normalizeAddress = (address: string): string => {
  return address
    .toLowerCase()                // Convert to lowercase
    .replace(/[.,]/g, '')         // Remove punctuation
    .replace(/\s+/g, ' ')         // Replace multiple spaces with a single space
    .replace(/flat/i, '')         // Remove 'flat' variations
    .replace(/(ground|first|second|third|fourth|fifth|top|basement)\s+floor/i, '') // Remove floor descriptions
    .replace(/(left|right)/i, '') // Remove left/right descriptions
    .replace(/\s*,\s*/g, ' ')     // Remove commas and surrounding spaces
    .trim();                      // Trim leading/trailing spaces
};

const compareAddresses = (propertyAddress: string, searchAddress: string): boolean => {
  const normalizedProperty = normalizeAddress(propertyAddress);
  const normalizedSearch = normalizeAddress(searchAddress);
  
  console.log(`Detailed address comparison:
    Property (original): "${propertyAddress}"
    Property (normalized): "${normalizedProperty}"
    Search (original): "${searchAddress}"
    Search (normalized): "${normalizedSearch}"
    Exact match: ${normalizedProperty === normalizedSearch}
  `);
  
  return normalizedProperty === normalizedSearch;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    console.log('Raw input address:', address);

    if (!address) {
      console.error('No address provided in request');
      return new Response(
        JSON.stringify({ 
          status: "error", 
          message: "Address is required",
          data: { properties: [] }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    const postcode = extractPostcode(address);
    console.log('Extracted postcode:', postcode);

    if (!postcode) {
      console.error('No valid postcode found in address:', address);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Please include a valid UK postcode in the address',
          data: { properties: [] }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const PROPERTY_DATA_API_KEY = Deno.env.get('PROPERTY_DATA_API_KEY');
    if (!PROPERTY_DATA_API_KEY) {
      console.error('PropertyData API key not found in environment variables');
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'API configuration error',
          data: { properties: [] }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const cleanPostcode = postcode.replace(/\s+/g, '');
    const propertyDataUrl = `https://api.propertydata.co.uk/floor-areas?key=${PROPERTY_DATA_API_KEY}&postcode=${cleanPostcode}`;
    console.log('Calling PropertyData API URL:', propertyDataUrl);
    
    const response = await fetch(propertyDataUrl);
    const data = await response.json();
    console.log('PropertyData API raw response:', data);

    if (!response.ok || data.status === 'error') {
      console.error('PropertyData API error:', data.message || response.statusText);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: data.message || 'Failed to fetch property data',
          data: { properties: [] }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const properties = data.known_floor_areas?.map((prop: any) => ({
      address: prop.address,
      floor_area_sq_ft: prop.square_feet || null,
      habitable_rooms: prop.habitable_rooms || 0,
      inspection_date: prop.inspection_date || new Date().toISOString(),
    })) || [];

    console.log('Transformed properties data:', properties);

    const isPostcodeOnly = address.trim().toUpperCase() === postcode.trim().toUpperCase();
    
    if (!isPostcodeOnly) {
      const searchAddressWithoutPostcode = address.replace(postcode, '').trim();
      console.log('Search address without postcode:', searchAddressWithoutPostcode);

      const exactMatches = properties.filter((prop) => 
        compareAddresses(prop.address, searchAddressWithoutPostcode)
      );

      console.log(`Found ${exactMatches.length} exact matches`);
      if (exactMatches.length === 0) {
        console.log('No exact matches found. Properties checked:');
        properties.forEach((prop) => {
          console.log(`Checked property: ${prop.address}`);
        });
      } else {
        console.log('Exact matches:', exactMatches);
      }

      return new Response(
        JSON.stringify({
          status: 'success',
          message: exactMatches.length === 0 
            ? 'No exact address match found. Showing all properties in the postcode area.' 
            : undefined,
          data: { properties: exactMatches.length > 0 ? exactMatches : properties }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: { properties }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: 'An unexpected error occurred',
        error: error.message,
        data: { properties: [] }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});