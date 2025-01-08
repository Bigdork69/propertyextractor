import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
          message: "Address is required",
          data: { properties: [] }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Clean up the postcode
    const postcode = address.trim().replace(/\s+/g, '');
    console.log('Cleaned postcode for API request:', postcode);
    
    const PROPERTY_DATA_API_KEY = Deno.env.get('PROPERTY_DATA_API_KEY');
    if (!PROPERTY_DATA_API_KEY) {
      console.error('PropertyData API key not found in environment variables');
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

    // Call PropertyData API
    const propertyDataUrl = `https://api.propertydata.co.uk/floor-areas?key=${PROPERTY_DATA_API_KEY}&postcode=${postcode}`;
    console.log('Calling PropertyData API URL:', propertyDataUrl);
    
    const response = await fetch(propertyDataUrl);
    const data = await response.json();
    console.log('PropertyData API raw response:', data);

    if (!response.ok) {
      console.error('PropertyData API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: `Failed to fetch property data. Please try again later.`,
          data: { properties: [] }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    if (data.status === 'error') {
      console.error('PropertyData API returned error:', data.message);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: data.message || 'Failed to fetch floor area data',
          data: { properties: [] }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const properties = data.known_floor_areas?.map((prop: any) => ({
      address: prop.address,
      floor_area_sq_ft: prop.square_feet || null,
      habitable_rooms: prop.habitable_rooms || 0,
      inspection_date: prop.inspection_date || new Date().toISOString(),
    })) || [];

    console.log('Transformed properties data:', properties);

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