import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizeAddress = (address: string): string => {
  return address
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s*,\s*/g, ' ')
    .replace(/\b(flat|apartment)\s+\d+\b/i, '')
    .replace(/\b(ground|first|second|third|fourth|fifth|top|basement)\s+floor\b/i, '')
    .replace(/\b(left|right)\b/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(north walsham)\b/i, '')
    .trim();
};

const extractPostcode = (input: string): string | null => {
  const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i;
  const match = input.match(postcodeRegex);
  return match ? match[1].trim() : null;
};

const compareAddresses = (propertyAddress: string, searchAddress: string): boolean => {
  const normalizedProperty = normalizeAddress(propertyAddress);
  const normalizedSearch = normalizeAddress(searchAddress);
  
  console.log(`Comparing addresses:
    Property (original): "${propertyAddress}"
    Property (normalized): "${normalizedProperty}"
    Search (original): "${searchAddress}"
    Search (normalized): "${normalizedSearch}"
    Match: ${normalizedProperty === normalizedSearch}
  `);
  
  return normalizedProperty === normalizedSearch;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    console.log('Received search address:', address);

    if (!address) {
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
    
    const response = await fetch(propertyDataUrl);
    const data = await response.json();
    console.log('PropertyData API response:', data);

    if (!response.ok || data.status === 'error') {
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

    // Filter for exact address match
    const searchAddressWithoutPostcode = address.replace(postcode, '').trim();
    const matchingProperties = data.known_floor_areas?.filter((prop: any) => 
      compareAddresses(prop.address, searchAddressWithoutPostcode)
    ) || [];

    if (matchingProperties.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'No exact match found for the address',
          data: { properties: [] }
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
        data: { properties: matchingProperties }
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