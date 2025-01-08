import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const extractPostcode = (input: string): string | null => {
  const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i;
  const match = input.match(postcodeRegex);
  return match ? match[1].trim() : null;
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

    // Extract postcode from the full address
    const postcode = extractPostcode(address);
    console.log('Extracted postcode:', postcode);

    if (!postcode) {
      console.error('No valid postcode found in address:', address);
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

    // Call PropertyData API with the extracted postcode
    const cleanPostcode = postcode.replace(/\s+/g, '');
    const propertyDataUrl = `https://api.propertydata.co.uk/floor-areas?key=${PROPERTY_DATA_API_KEY}&postcode=${cleanPostcode}`;
    console.log('Calling PropertyData API URL:', propertyDataUrl);
    
    const response = await fetch(propertyDataUrl);
    const data = await response.json();
    console.log('PropertyData API raw response:', data);

    if (!response.ok || data.status === 'error') {
      console.error('PropertyData API error:', data.message || response.statusText);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: data.message || 'Failed to fetch property data',
          data: { properties: [] }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Transform and normalize the property data
    const properties = data.known_floor_areas?.map((prop: any) => ({
      address: prop.address,
      floor_area_sq_ft: prop.square_feet || null,
      habitable_rooms: prop.habitable_rooms || 0,
      inspection_date: prop.inspection_date || new Date().toISOString(),
    })) || [];

    console.log('Transformed properties data:', properties);

    // If a full address was provided (not just a postcode), filter for exact matches
    const isPostcodeOnly = address.trim().toUpperCase() === postcode.trim().toUpperCase();
    
    if (!isPostcodeOnly) {
      // Remove the postcode from the search address for comparison
      const searchAddress = address
        .replace(postcode, '')
        .toLowerCase()
        .replace(/[.,]/g, '')
        .trim();
      
      console.log('Searching for exact address match:', searchAddress);

      // Filter for exact address matches (case-insensitive)
      const exactMatches = properties.filter(prop => {
        const propAddress = prop.address
          .toLowerCase()
          .replace(/[.,]/g, '')
          .replace(postcode.toLowerCase(), '')
          .trim();
        
        return propAddress === searchAddress;
      });

      console.log('Found exact matches:', exactMatches.length);

      // Return exact matches if found, otherwise return all properties with a message
      return new Response(
        JSON.stringify({
          status: 'success',
          message: exactMatches.length === 0 ? 'No exact address match found. Showing all properties in the postcode area.' : undefined,
          data: { 
            properties: exactMatches.length > 0 ? exactMatches : properties
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Return all properties for postcode-only searches
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