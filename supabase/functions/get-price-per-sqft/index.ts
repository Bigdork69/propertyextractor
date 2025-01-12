import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchPriceData(postcode: string, apiKey: string) {
  console.log('Fetching price data for postcode:', postcode);
  
  const url = new URL('https://api.propertydata.co.uk/prices-per-sqf');
  url.searchParams.append('key', apiKey);
  url.searchParams.append('postcode', postcode);
  
  try {
    console.log('Making price API request to:', url.toString());
    const response = await fetch(url.toString());
    const data = await response.json();
    console.log('Price data API response:', data);
    
    if (data.status === 'error') {
      console.error('Price data API error:', data.message);
      return {
        status: 'error',
        message: data.message || 'Failed to fetch price data'
      };
    }
    
    return {
      status: 'success',
      data: {
        price_per_sq_ft: data.average_price_per_sqf || null,
        price_per_sq_m: data.average_price_per_sqf ? (data.average_price_per_sqf * 10.764) : null,
        pricing_date: data.last_updated || null,
        transaction_count: data.samples || null,
        property_type_prices: data.property_type_prices || null,
        property_condition_prices: data.property_condition_prices || null
      }
    };
  } catch (error) {
    console.error('Error fetching price data:', error);
    return {
      status: 'error',
      message: 'Failed to fetch price data'
    };
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
          message: "Address or postcode is required"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    const PROPERTY_DATA_API_KEY = Deno.env.get('PROPERTY_DATA_API_KEY');
    if (!PROPERTY_DATA_API_KEY) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'API configuration error'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    const cleanPostcode = address.replace(/\s+/g, '');
    console.log('Fetching price data for postcode:', cleanPostcode);
    
    const priceData = await fetchPriceData(cleanPostcode, PROPERTY_DATA_API_KEY);

    return new Response(
      JSON.stringify(priceData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: priceData.status === 'success' ? 200 : 400
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: 'An unexpected error occurred',
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});