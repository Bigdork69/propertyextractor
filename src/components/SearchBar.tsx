import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useToast } from "./ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const SearchBar = () => {
  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      toast({
        title: "Error",
        description: "Please enter an address with a valid UK postcode",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-floor-area', {
        body: { address: address.trim() }
      });

      if (error) throw error;

      if (data.status === "error") {
        toast({
          title: "Error",
          description: data.message || "Failed to fetch floor area data",
          variant: "destructive",
        });
        return;
      }

      // Format the floor area data for display
      const floorArea = data.data?.total_floor_area_sq_m;
      const floorAreaSqFt = data.data?.total_floor_area_sq_ft;

      if (!floorArea) {
        toast({
          title: "No Data Available",
          description: "Could not find floor area data for this address",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Floor Area Details",
        description: `Total floor area: ${floorArea} m² (${floorAreaSqFt} sq ft)`,
      });

    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Error",
        description: "Failed to fetch floor area data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full max-w-2xl">
      <div className="relative w-full bg-white/95 rounded-full overflow-hidden flex">
        <Input
          type="text"
          placeholder="Enter full property address with postcode (e.g. 15 Venetia Road, London, W5 4JD)"
          className="pl-12 pr-6 py-6 w-full border-none text-lg"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={isLoading}
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-estate-400 w-5 h-5" />
        <Button 
          type="submit" 
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
          disabled={isLoading}
        >
          {isLoading ? "Searching..." : "Search"}
        </Button>
      </div>
    </form>
  );
};

export default SearchBar;