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
  return normalizedProperty === normalizedSearch;
};

async function fetchPriceData(postcode: string, apiKey: string) {
  console.log('Fetching price data for postcode:', postcode);
  
  const url = new URL('https://api.propertydata.co.uk/prices-per-sqf');
  url.searchParams.append('key', apiKey);
  url.searchParams.append('postcode', postcode);
  
  try {
    console.log('Making API request to:', url.toString());
    const response = await fetch(url.toString());
    const data = await response.json();
    console.log('Price data API response:', data);
    
    if (data.status === 'error') {
      console.error('Price data API error:', data.message);
      return null;
    }
    
    if (!data.data) {
      console.log('No price data available for postcode:', postcode);
      return null;
    }
    
    return {
      price_per_sq_ft: data.data.average_price_per_sqf || null,
      price_per_sq_m: (data.data.average_price_per_sqf * 10.764) || null,
      pricing_date: data.data.last_updated || null,
      transaction_count: data.data.samples || null
    };
  } catch (error) {
    console.error('Error fetching price data:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();

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
    
    console.log('Fetching data for postcode:', cleanPostcode);
    
    const [floorAreaResponse, priceData] = await Promise.all([
      fetch(propertyDataUrl),
      fetchPriceData(cleanPostcode, PROPERTY_DATA_API_KEY)
    ]);

    const floorAreaData = await floorAreaResponse.json();
    console.log('Floor area API response:', floorAreaData);

    if (!floorAreaResponse.ok || floorAreaData.status === 'error') {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: floorAreaData.message || 'Failed to fetch property data',
          data: { properties: [] }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const searchAddressWithoutPostcode = address.replace(postcode, '').trim();

    const properties = floorAreaData.known_floor_areas?.map((prop: any) => {
      const isMatch = compareAddresses(prop.address, searchAddressWithoutPostcode);
      const estimatedValue = priceData?.price_per_sq_ft && prop.floor_area_sq_ft 
        ? prop.floor_area_sq_ft * priceData.price_per_sq_ft 
        : null;
      
      console.log('Processing property:', {
        address: prop.address,
        floorArea: prop.floor_area_sq_ft,
        pricePerSqFt: priceData?.price_per_sq_ft,
        estimatedValue
      });
      
      return {
        ...prop,
        price_per_sq_ft: priceData?.price_per_sq_ft || null,
        price_per_sq_m: priceData?.price_per_sq_m || null,
        pricing_date: priceData?.pricing_date || null,
        transaction_count: priceData?.transaction_count || null,
        estimated_value: estimatedValue
      };
    }) || [];

    console.log('Returning properties with price data:', properties);

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