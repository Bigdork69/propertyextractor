import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    console.log('Received request with address:', address);

    if (!address) {
      console.error('No address provided in request');
      return new Response(
        JSON.stringify({ 
          status: "error", 
          message: "Address is required" 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Extract postcode using regex
    const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i;
    const postcodeMatch = address.match(postcodeRegex);
    
    if (!postcodeMatch) {
      console.error('No valid UK postcode found in address:', address);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'No valid UK postcode found in the address'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    const postcode = postcodeMatch[0].replace(/\s/g, '');
    console.log('Extracted postcode:', postcode);
    
    const PROPERTY_DATA_API_KEY = Deno.env.get('PROPERTY_DATA_API_KEY');
    if (!PROPERTY_DATA_API_KEY) {
      console.error('PropertyData API key not found in environment variables');
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

    // Call PropertyData API
    const propertyDataUrl = `https://api.propertydata.co.uk/floor-areas?key=${PROPERTY_DATA_API_KEY}&postcode=${postcode}`;
    console.log('Calling PropertyData API URL:', propertyDataUrl);
    
    const response = await fetch(propertyDataUrl);
    if (!response.ok) {
      console.error('PropertyData API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: `PropertyData API error: ${response.status} ${response.statusText}`
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: response.status
        }
      );
    }

    const data = await response.json();
    console.log('PropertyData API response:', data);

    // Check if the API returned an error
    if (data.status === 'error') {
      console.error('PropertyData API returned error:', data.message);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: data.message || 'Failed to fetch floor area data'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Check if we have actual floor area data
    if (!data.data || !data.data.length) {
      console.error('No floor area data available for postcode:', postcode);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'No floor area data available for this postcode'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      );
    }

    // Calculate average floor area
    const totalFloorArea = data.data.reduce((sum: number, item: any) => sum + item.total_floor_area, 0);
    const averageFloorArea = totalFloorArea / data.data.length;
    
    // Convert to square feet (1 sq m = 10.764 sq ft)
    const averageFloorAreaSqFt = averageFloorArea * 10.764;

    // Log the search in Supabase
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    const { error: logError } = await supabase
      .from('property_search_logs')
      .insert({
        search_query: address,
        response: data,
      });

    if (logError) {
      console.error('Error logging search:', logError);
    }

    const result = {
      status: 'success',
      data: {
        total_floor_area_sq_m: Math.round(averageFloorArea * 100) / 100,
        total_floor_area_sq_ft: Math.round(averageFloorAreaSqFt * 100) / 100
      }
    };
    console.log('Returning result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: 'Failed to fetch floor area data',
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});