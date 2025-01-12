import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PROPERTY_DATA_API_KEY = Deno.env.get('PROPERTY_DATA_API_KEY') || 'S4AWLMDMHH';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceResponse {
  status: string;
  postcode?: string;
  average_price_per_sqf?: number;
  property_type_prices?: {
    [key: string]: number;
  };
  property_condition_prices?: {
    [key: string]: number;
  };
  message?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { postcode } = await req.json();

    if (!postcode) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Postcode is required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const cleanPostcode = postcode.replace(/\s+/g, '');
    console.log('Fetching price per sqft data for postcode:', cleanPostcode);

    const url = new URL('https://api.propertydata.co.uk/prices-per-sqf');
    url.searchParams.append('key', PROPERTY_DATA_API_KEY);
    url.searchParams.append('postcode', cleanPostcode);

    console.log('Making API request to:', url.toString());
    const response = await fetch(url.toString());
    const data: PriceResponse = await response.json();
    console.log('Price per sqft API response:', data);

    if (!response.ok || data.status === 'error') {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: data.message || 'Failed to fetch price per sqft data',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: response.ok ? 400 : 500,
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: {
          average_price_per_sqf: data.average_price_per_sqf,
          property_type_prices: data.property_type_prices,
          property_condition_prices: data.property_condition_prices,
          postcode: data.postcode,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in get-price-per-sqft function:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});