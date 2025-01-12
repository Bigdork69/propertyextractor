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

async function fetchPropertyData(postcode: string, apiKey: string) {
  console.log('Fetching property data for postcode:', postcode);
  
  try {
    // Fetch both floor areas and price per square foot data in parallel
    const [floorAreasResponse, priceResponse] = await Promise.all([
      fetch(`https://api.propertydata.co.uk/floor-areas?key=${apiKey}&postcode=${postcode}`),
      fetch(`https://api.propertydata.co.uk/prices-per-sqf?key=${apiKey}&postcode=${postcode}`)
    ]);

    const floorAreasData = await floorAreasResponse.json();
    const priceData = await priceResponse.json();

    console.log('Floor areas response:', floorAreasData);
    console.log('Price data response:', priceData);

    if (floorAreasData.status === 'error') {
      console.error('Floor areas error:', floorAreasData.message);
      return {
        status: 'error',
        message: floorAreasData.message,
        data: { properties: [] }
      };
    }

    // Extract price data
    const priceInfo = priceData.status === 'error' ? null : {
      price_per_sq_ft: priceData.data?.price_per_sqf || null,
      price_per_sq_m: priceData.data?.price_per_sqm || null,
      pricing_date: priceData.data?.last_updated || null,
      transaction_count: priceData.data?.samples || null
    };

    // Map the properties with correct field names
    const properties = floorAreasData.known_floor_areas.map((property: any) => ({
      address: property.address,
      floor_area_sq_ft: property.square_feet,
      floor_area_sq_m: property.square_meters || Math.round(property.square_feet * 0.092903),
      habitable_rooms: property.habitable_rooms,
      inspection_date: property.inspection_date,
      ...(priceInfo && {
        price_per_sq_ft: priceInfo.price_per_sq_ft,
        price_per_sq_m: priceInfo.price_per_sq_m,
        pricing_date: priceInfo.pricing_date,
        transaction_count: priceInfo.transaction_count,
        estimated_value: property.square_feet && priceInfo.price_per_sq_ft 
          ? property.square_feet * priceInfo.price_per_sq_ft 
          : null
      })
    }));

    return {
      status: 'success',
      data: { properties }
    };

  } catch (error) {
    console.error('Error fetching property data:', error);
    return {
      status: 'error',
      message: 'Failed to fetch property data',
      data: { properties: [] }
    };
  }
}

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
    const result = await fetchPropertyData(cleanPostcode, PROPERTY_DATA_API_KEY);

    return new Response(
      JSON.stringify(result),
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