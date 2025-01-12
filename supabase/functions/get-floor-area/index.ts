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

async function fetchPriceData(postcode: string, apiKey: string) {
  console.log('Starting price data fetch for postcode:', postcode);
  const priceDataUrl = `https://api.propertydata.co.uk/prices-per-sqf?key=${apiKey}&postcode=${postcode}`;
  console.log('Price data API URL:', priceDataUrl.replace(apiKey, '[REDACTED]'));
  
  try {
    console.log('Making API request to propertydata.co.uk...');
    const response = await fetch(priceDataUrl);
    const data = await response.json();
    console.log('Raw price data response:', JSON.stringify(data, null, 2));
    
    if (data.status === 'error') {
      console.error('Price data API error:', data.message);
      return null;
    }
    
    if (!data.data?.price_per_sqf) {
      console.warn('No price per square foot data available in response');
      return null;
    }
    
    const result = {
      price_per_sq_ft: data.data?.price_per_sqf || null,
      price_per_sq_m: data.data?.price_per_sqm || null,
      pricing_date: data.data?.last_updated || null,
      transaction_count: data.data?.samples || null
    };
    
    console.log('Transformed price data:', result);
    return result;
  } catch (error) {
    console.error('Error fetching price data:', error);
    return null;
  }
}

serve(async (req) => {
  console.log('Request received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    console.log('Received search address:', address);

    if (!address) {
      console.log('Error: No address provided');
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
      console.log('Error: No valid postcode found in address');
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
      console.error('API configuration error: Missing API key');
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
    console.log('Clean postcode for API call:', cleanPostcode);
    
    const propertyDataUrl = `https://api.propertydata.co.uk/floor-areas?key=${PROPERTY_DATA_API_KEY}&postcode=${cleanPostcode}`;
    console.log('Floor areas API URL:', propertyDataUrl.replace(PROPERTY_DATA_API_KEY, '[REDACTED]'));
    
    const [floorAreaResponse, priceData] = await Promise.all([
      fetch(propertyDataUrl),
      fetchPriceData(cleanPostcode, PROPERTY_DATA_API_KEY)
    ]);

    const floorAreaData = await floorAreaResponse.json();
    console.log('Floor area API response:', JSON.stringify(floorAreaData, null, 2));

    if (!floorAreaResponse.ok || floorAreaData.status === 'error') {
      console.error('Floor area API error:', floorAreaData);
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
    console.log('Search address without postcode:', searchAddressWithoutPostcode);

    const matchingProperties = floorAreaData.known_floor_areas?.map((prop: any) => {
      console.log('Processing property:', prop);
      const isMatch = compareAddresses(prop.address, searchAddressWithoutPostcode);
      
      if (isMatch && priceData) {
        const estimatedValue = prop.floor_area_sq_ft && priceData.price_per_sq_ft
          ? prop.floor_area_sq_ft * priceData.price_per_sq_ft
          : null;
        
        console.log('Match found! Adding price data:', {
          address: prop.address,
          estimatedValue,
          priceData
        });
        
        return {
          ...prop,
          ...priceData,
          estimated_value: estimatedValue
        };
      }
      return prop;
    }).filter((prop: any) => compareAddresses(prop.address, searchAddressWithoutPostcode)) || [];

    console.log('Final matching properties:', matchingProperties);

    if (matchingProperties.length === 0) {
      console.log('No matching properties found');
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

    console.log('Sending successful response with properties');
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
