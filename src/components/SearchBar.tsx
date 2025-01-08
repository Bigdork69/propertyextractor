import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PropertyDataResults from "./PropertyDataResults";
import * as XLSX from 'xlsx';

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
  const [showingAllPostcodeResults, setShowingAllPostcodeResults] = useState(false);
  const { toast } = useToast();

  const validatePostcode = (postcode: string) => {
    const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    return postcodeRegex.test(postcode.trim());
  };

  const extractPostcode = (input: string) => {
    const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i;
    const match = input.match(postcodeRegex);
    return match ? match[1] : null;
  };

  const normalizeAddress = (addr: string) => {
    return addr.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,]/g, '')
      .trim();
  };

  const handleExportToExcel = () => {
    if (!propertyData || propertyData.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There is no data available to export.",
        variant: "destructive",
      });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(propertyData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Property Data");

    const searchTerm = address.trim().replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `property_data_${searchTerm}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    
    toast({
      title: "Export Successful",
      description: `Data has been exported to ${fileName}`,
    });
  };

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

    // Extract postcode from input if it's a full address, or use the input directly if it's just a postcode
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

      let transformedData = response.data.properties;
      console.log('Transformed data before filtering:', transformedData);

      // If it's not just a postcode, filter for exact address match
      if (!isPostcodeOnly) {
        const normalizedSearchAddress = normalizeAddress(trimmedAddress);
        const filteredData = transformedData.filter(prop => 
          normalizeAddress(prop.address).includes(normalizedSearchAddress.replace(postcode, '').trim())
        );

        if (filteredData.length === 0) {
          setShowingAllPostcodeResults(true);
          toast({
            title: "No Exact Match Found",
            description: "No data found for this exact address. Showing all properties in the postcode area instead.",
          });
        } else {
          transformedData = filteredData;
        }
      }

      console.log('Final filtered data:', transformedData);
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

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <form onSubmit={handleSearch} className="relative w-full">
        <div className="relative w-full bg-white/95 rounded-full overflow-hidden flex shadow-lg">
          <Input
            type="text"
            placeholder="Enter a postcode (e.g., W14 9JH) or exact address with postcode"
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

      {showingAllPostcodeResults && propertyData && propertyData.length > 0 && (
        <div className="mt-4 text-estate-600 text-center">
          Showing all properties in the postcode area
        </div>
      )}

      {propertyData && propertyData.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleExportToExcel}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Export to Excel
          </Button>
        </div>
      )}

      <PropertyDataResults 
        data={propertyData}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
};

export default SearchBar;