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
    console.log('Searching floor area for address:', address);

    if (!address) {
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

    // Format address to include London if not present
    let formattedAddress = address;
    if (!address.toLowerCase().includes('london')) {
      formattedAddress = `${address}, London`;
    }

    const PROPERTY_DATA_API_KEY = Deno.env.get('PROPERTY_DATA_API_KEY');
    
    // Extract postcode using regex
    const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i;
    const postcodeMatch = formattedAddress.match(postcodeRegex);
    
    if (!postcodeMatch) {
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
    
    // Call PropertyData API with the correct endpoint and parameters
    const propertyDataUrl = `https://api.propertydata.co.uk/floor-areas?key=${PROPERTY_DATA_API_KEY}&postcode=${postcode}`;
    console.log('Calling PropertyData API URL:', propertyDataUrl);
    
    const response = await fetch(propertyDataUrl);
    const data = await response.json();
    console.log('PropertyData API response:', data);

    // Check if the API returned an error
    if (data.status === 'error') {
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
        search_query: formattedAddress,
        response: data,
      });

    if (logError) {
      console.error('Error logging search:', logError);
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: {
          total_floor_area_sq_m: Math.round(averageFloorArea * 100) / 100,
          total_floor_area_sq_ft: Math.round(averageFloorAreaSqFt * 100) / 100
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: 'Failed to fetch floor area data' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});