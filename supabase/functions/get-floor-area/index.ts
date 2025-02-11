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
  const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9]?[A-Z]{0,2})/i;
  const match = input.match(postcodeRegex);
  return match ? match[1].trim() : null;
};

const calculateDaysAgo = (dateString: string): number => {
  const lastUpdated = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastUpdated.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const calculateConfidenceLevel = (sampleSize: number, dataAgeDays: number): 'High' | 'Medium' | 'Low' => {
  if (sampleSize > 30 && dataAgeDays < 90) return 'High';
  if (sampleSize > 10 && dataAgeDays < 180) return 'Medium';
  return 'Low';
};

async function fetchPropertyData(postcode: string, apiKey: string) {
  console.log('Fetching property data for postcode:', postcode);
  
  try {
    const [floorAreasResponse, priceResponse] = await Promise.all([
      fetch(`https://api.propertydata.co.uk/floor-areas?key=${apiKey}&postcode=${postcode}`),
      fetch(`https://api.propertydata.co.uk/sold-prices-per-sqf?key=${apiKey}&postcode=${postcode}`)
    ]);

    const floorAreasData = await floorAreasResponse.json();
    const priceData = await priceResponse.json();

    console.log('Floor areas response:', JSON.stringify(floorAreasData, null, 2));
    console.log('Price data response:', JSON.stringify(priceData, null, 2));

    if (floorAreasData.status === 'error') {
      console.error('Floor areas error:', floorAreasData.message);
      return {
        status: 'error',
        message: floorAreasData.message,
        data: { properties: [] }
      };
    }

    const dataAgeDays = calculateDaysAgo(priceData.last_updated);
    
    // Extract price info with confidence intervals
    const priceInfo = priceData.status === 'error' ? null : {
      price_per_sq_ft: priceData.data?.average || null,
      price_per_sq_m: (priceData.data?.average * 10.764) || null,
      pricing_date: priceData.last_updated || null,
      transaction_count: priceData.data?.points_analysed || null,
      lower_bound_price: priceData.data?.confidence_interval?.lower || null,
      upper_bound_price: priceData.data?.confidence_interval?.upper || null,
      data_age_days: dataAgeDays,
      confidence_level: calculateConfidenceLevel(
        priceData.data?.points_analysed || 0,
        dataAgeDays
      )
    };

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
        lower_bound_price: priceInfo.lower_bound_price,
        upper_bound_price: priceInfo.upper_bound_price,
        data_age_days: priceInfo.data_age_days,
        confidence_level: priceInfo.confidence_level,
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
