import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
          message: "Address is required",
          data: { properties: [] }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
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
          message: 'No valid UK postcode found in the address',
          data: { properties: [] }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
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

    // Check if the API call was successful
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

    // Check if the API returned an error
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

    // Transform the data for the frontend, using square_feet field directly
    const properties = data.known_floor_areas?.map((prop: any) => ({
      address: prop.address,
      floor_area_sq_ft: prop.square_feet || null, // Use square_feet directly instead of converting
      habitable_rooms: prop.habitable_rooms || 0,
      inspection_date: prop.inspection_date || new Date().toISOString(),
    })) || [];

    console.log('Transformed properties data:', properties);

    // Return the successful response
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