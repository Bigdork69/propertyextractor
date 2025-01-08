import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PropertyDataResults from "./PropertyDataResults";

interface PropertyData {
  address: string;
  floor_area_sq_ft: number;
  habitable_rooms: number;
  inspection_date: string;
}

const SearchBar = () => {
  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyData, setPropertyData] = useState<PropertyData[] | null>(null);
  const { toast } = useToast();

  const validatePostcode = (postcode: string) => {
    const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    return postcodeRegex.test(postcode.trim());
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPropertyData(null);

    if (!address.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid UK postcode",
        variant: "destructive",
      });
      return;
    }

    if (!validatePostcode(address)) {
      toast({
        title: "Invalid Postcode",
        description: "Please enter a valid UK postcode format (e.g., W14 9JH)",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: response, error: functionError } = await supabase.functions.invoke('get-floor-area', {
        body: { address: address.trim() }
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

      // Transform the data for the table display
      const transformedData: PropertyData[] = response.data.properties.map((prop: any) => ({
        address: prop.address,
        floor_area_sq_ft: prop.floor_area_sq_ft,
        habitable_rooms: prop.habitable_rooms || 0,
        inspection_date: prop.inspection_date || new Date().toISOString(),
      }));

      setPropertyData(transformedData);

      if (transformedData.length === 0) {
        toast({
          title: "No Data Available",
          description: "No floor area data found for this postcode. Please try another one.",
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

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <form onSubmit={handleSearch} className="relative w-full">
        <div className="relative w-full bg-white/95 rounded-full overflow-hidden flex shadow-lg">
          <Input
            type="text"
            placeholder="Enter a postcode (e.g., W14 9JH)"
            className="pl-12 pr-6 py-6 w-full border-none text-lg"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isLoading}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-estate-400 w-5 h-5" />
          <Button 
            type="submit" 
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-6"
            disabled={isLoading}
          >
            {isLoading ? "Searching..." : "Search"}
          </Button>
        </div>
      </form>

      <PropertyDataResults 
        data={propertyData}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
};

export default SearchBar;