import { usePropertySearch } from "@/hooks/usePropertySearch";
import SearchForm from "./SearchForm";
import PropertyDataResults from "./PropertyDataResults";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

const SearchBar = () => {
  const { 
    address, 
    setAddress, 
    isLoading, 
    error, 
    propertyData, 
    showingAllPostcodeResults, 
    handleSearch 
  } = usePropertySearch();
  
  const { toast } = useToast();

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

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <SearchForm
        address={address}
        onAddressChange={setAddress}
        onSubmit={handleSearch}
        isLoading={isLoading}
      />

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