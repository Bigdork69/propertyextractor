import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validatePostcode, extractPostcode, normalizeAddress } from "@/utils/searchUtils";
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
      console.log('Sending request to Edge Function with postcode:', postcode);
      
      const { data: response, error: functionError } = await supabase.functions.invoke('get-floor-area', {
        body: { address: postcode }
      });

      console.log('Edge function response:', response);

      if (functionError) {
        console.error('Supabase function error:', functionError);
        throw functionError;
      }

      if (response.status === "error") {
        setError(response.message || "Failed to fetch floor area data");
        toast({
          title: "Error",
          description: response.message || "Failed to fetch floor area data",
          variant: "destructive",
        });
        return;
      }

      let transformedData = response.data.properties.map((prop: any) => ({
        ...prop,
        floor_area_sq_m: convertToSquareMeters(prop.floor_area_sq_ft)
      }));

      if (!isPostcodeOnly) {
        const normalizedSearchAddress = normalizeAddress(trimmedAddress);
        const filteredData = transformedData.filter(prop => 
          normalizeAddress(prop.address).includes(normalizedSearchAddress.replace(postcode, '').trim())
        );

        if (filteredData.length === 0) {
          setPropertyData(null); // Show no results instead of all properties
          toast({
            title: "No Exact Match Found",
            description: "No data found for this exact address.",
          });
          return; // Exit early without showing any results
        } else {
          transformedData = filteredData;
        }
      }

      setPropertyData(transformedData);

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
        description: "Failed to fetch floor area data. Please try again.",
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