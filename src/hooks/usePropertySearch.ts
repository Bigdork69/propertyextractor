import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validatePostcode, extractPostcode, findMatches } from "@/utils/searchUtils";
import { convertToSquareMeters } from "@/utils/propertyUtils";
import { PropertyData } from "@/types/property";

export const usePropertySearch = () => {
  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyData, setPropertyData] = useState<PropertyData[] | null>(null);
  const [showingAllPostcodeResults, setShowingAllPostcodeResults] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPropertyData(null);
    setShowingAllPostcodeResults(false);

    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      toast({
        title: "Error",
        description: "Please enter a valid UK postcode or address",
        variant: "destructive",
      });
      return;
    }

    const postcode = extractPostcode(trimmedAddress);
    const isPostcodeOnly = validatePostcode(trimmedAddress);
    
    if (!postcode) {
      toast({
        title: "Invalid Input",
        description: "Please include a valid UK postcode in the address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Search initiated with:', {
        fullAddress: trimmedAddress,
        postcode,
        isPostcodeOnly
      });
      
      // Fetch both floor area and price data in parallel
      const [floorAreaResponse, priceResponse] = await Promise.all([
        supabase.functions.invoke('get-floor-area', {
          body: { address: postcode }
        }),
        supabase.functions.invoke('get-price-per-sqft', {
          body: { address: postcode }
        })
      ]);

      console.log('API Responses:', {
        floorArea: floorAreaResponse,
        price: priceResponse
      });

      if (floorAreaResponse.error) {
        console.error('Floor area function error:', floorAreaResponse.error);
        throw floorAreaResponse.error;
      }

      if (priceResponse.error) {
        console.error('Price function error:', priceResponse.error);
        throw priceResponse.error;
      }

      if (floorAreaResponse.data.status === "error") {
        setError(floorAreaResponse.data.message || "Failed to fetch floor area data");
        toast({
          title: "Error",
          description: floorAreaResponse.data.message || "Failed to fetch floor area data",
          variant: "destructive",
        });
        return;
      }

      let transformedData = floorAreaResponse.data.data.properties.map((prop: any) => ({
        ...prop,
        floor_area_sq_m: convertToSquareMeters(prop.floor_area_sq_ft),
        price_per_sq_ft: priceResponse.data.data?.price_per_sq_ft || null,
        price_per_sq_m: priceResponse.data.data?.price_per_sq_m || null,
        pricing_date: priceResponse.data.data?.pricing_date || null,
        transaction_count: priceResponse.data.data?.transaction_count || null,
        estimated_value: prop.floor_area_sq_ft && priceResponse.data.data?.price_per_sq_ft 
          ? prop.floor_area_sq_ft * priceResponse.data.data.price_per_sq_ft 
          : null
      }));

      if (!isPostcodeOnly) {
        const { matches, type } = findMatches(transformedData, trimmedAddress);
        
        if (matches.length === 0) {
          console.log('No matches found for:', trimmedAddress);
          setPropertyData(null);
          toast({
            title: "No Matches Found",
            description: "No matching properties found for this address.",
          });
          return;
        }

        if (type === 'partial') {
          toast({
            title: "Showing Partial Matches",
            description: "Exact match not found. Showing similar addresses.",
          });
        }

        transformedData = matches;
      }

      setPropertyData(transformedData);
      setShowingAllPostcodeResults(isPostcodeOnly);

      if (transformedData.length === 0) {
        toast({
          title: "No Data Available",
          description: "No floor area data found for this location. Please try another address or postcode.",
        });
      }

    } catch (error) {
      console.error('Search error:', error);
      setError("There was an error retrieving the data. Please try again later.");
      toast({
        title: "Error",
        description: "Failed to fetch property data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    address,
    setAddress,
    isLoading,
    error,
    propertyData,
    showingAllPostcodeResults,
    handleSearch
  };
};