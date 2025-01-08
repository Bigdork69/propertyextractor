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
    
    // Call PropertyData API with the correct endpoint and parameters
    const propertyDataUrl = `https://api.propertydata.co.uk/floor-areas?key=${PROPERTY_DATA_API_KEY}&address=${encodeURIComponent(formattedAddress)}`;
    console.log('Calling PropertyData API URL:', propertyDataUrl);
    
    const response = await fetch(propertyDataUrl);
    const data = await response.json();
    console.log('PropertyData API response:', data);

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

    // Return the API response with proper error handling
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

    return new Response(
      JSON.stringify(data),
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