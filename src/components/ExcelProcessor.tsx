import { useState } from "react";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { convertToSquareMeters } from "@/utils/propertyUtils";
import { Loader2 } from "lucide-react";

interface ProcessedData {
  address: string;
  postcode: string;
  floor_area_sq_ft: number | null;
  floor_area_sq_m: number | null;
  habitable_rooms: number;
  inspection_date: string;
}

const ExcelProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const extractPostcode = (input: string): string | null => {
    const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i;
    const match = input.match(postcodeRegex);
    return match ? match[1].trim() : null;
  };

  const processExcelFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const processedData: ProcessedData[] = [];
      const errors: string[] = [];

      for (const row of jsonData) {
        const rowData = row as any;
        const address = rowData['Address'] || rowData['ADDRESS'] || '';
        const postcode = extractPostcode(address);

        if (!postcode) {
          errors.push(`Invalid postcode in address: ${address}`);
          continue;
        }

        try {
          console.log('Querying API for postcode:', postcode);
          const { data: response, error: functionError } = await supabase.functions.invoke('get-floor-area', {
            body: { address: postcode }
          });

          if (functionError || response.status === "error") {
            errors.push(`Error fetching data for ${address}: ${functionError?.message || response?.message}`);
            continue;
          }

          const propertyData = response.data.properties.find((prop: any) => 
            prop.address.toLowerCase().includes(address.toLowerCase())
          );

          if (propertyData) {
            processedData.push({
              address,
              postcode,
              floor_area_sq_ft: propertyData.floor_area_sq_ft,
              floor_area_sq_m: convertToSquareMeters(propertyData.floor_area_sq_ft),
              habitable_rooms: propertyData.habitable_rooms,
              inspection_date: propertyData.inspection_date
            });
          } else {
            errors.push(`No matching property found for address: ${address}`);
          }
        } catch (error) {
          console.error('Error processing address:', address, error);
          errors.push(`Error processing ${address}: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        console.log('Processing errors:', errors);
        toast({
          title: "Some addresses could not be processed",
          description: `${errors.length} errors occurred. Check the console for details.`,
          variant: "destructive",
        });
      }

      return processedData;
    } catch (error) {
      console.error('Excel processing error:', error);
      throw new Error('Failed to process Excel file');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel file (.xlsx or .xls)",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const processedData = await processExcelFile(file);
      
      if (processedData.length > 0) {
        // Create a new workbook with the processed data
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(processedData);
        XLSX.utils.book_append_sheet(wb, ws, "Processed Data");
        
        // Generate the Excel file
        const fileName = `processed_${file.name}`;
        XLSX.writeFile(wb, fileName);
        
        toast({
          title: "Processing Complete",
          description: `Successfully processed ${processedData.length} addresses. The file has been downloaded.`,
        });
      } else {
        toast({
          title: "No Data Processed",
          description: "No valid addresses were found in the file.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process the Excel file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      event.target.value = ''; // Reset the file input
    }
  };

  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold text-estate-800 mb-2">Bulk Process Addresses</h2>
        <p className="text-estate-600">Upload an Excel file with addresses to get floor area data</p>
      </div>
      <div className="flex items-center gap-4">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          disabled={isProcessing}
          className="hidden"
          id="excel-upload"
        />
        <label
          htmlFor="excel-upload"
          className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-estate-600 hover:bg-estate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-estate-500 ${
            isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Processing...
            </>
          ) : (
            'Upload Excel File'
          )}
        </label>
      </div>
    </div>
  );
};

export default ExcelProcessor;