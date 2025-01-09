import { useState } from "react";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { convertToSquareMeters } from "@/utils/propertyUtils";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProcessedData {
  address: string;
  postcode: string;
  floor_area_sq_ft: number | null;
  floor_area_sq_m: number | null;
  habitable_rooms: number;
  inspection_date: string;
}

interface PreviewData {
  address: string;
  postcode: string;
  isValid: boolean;
  error?: string;
}

const ExcelProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const { toast } = useToast();

  const extractPostcode = (input: string): string | null => {
    const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i;
    const match = input.match(postcodeRegex);
    return match ? match[1].trim() : null;
  };

  const validateRow = (address: string, postcode: string): { isValid: boolean; error?: string } => {
    if (!address) {
      return { isValid: false, error: "Missing address" };
    }
    if (!postcode) {
      return { isValid: false, error: "Missing or invalid postcode" };
    }
    return { isValid: true };
  };

  const generatePreview = (worksheet: XLSX.WorkSheet) => {
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    const preview: PreviewData[] = [];

    for (const row of jsonData) {
      const rowData = row as any;
      const address = rowData['Address'] || rowData['ADDRESS'] || '';
      const postcode = rowData['Post Code'] || rowData['POST CODE'] || rowData['Postcode'] || rowData['POSTCODE'] || '';
      
      // Skip completely empty rows
      if (!address && !postcode) continue;
      
      const validation = validateRow(address, postcode);

      preview.push({
        address,
        postcode,
        isValid: validation.isValid,
        error: validation.error
      });
    }

    setPreviewData(preview);
  };

  const processExcelFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      setSelectedSheet(wb.SheetNames[0]);
      generatePreview(wb.Sheets[wb.SheetNames[0]]);
    } catch (error) {
      console.error('Excel file reading error:', error);
      toast({
        title: "Error Reading File",
        description: "Failed to read the Excel file. Please check the file format.",
        variant: "destructive",
      });
    }
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbook) {
      generatePreview(workbook.Sheets[sheetName]);
    }
  };

  const processData = async () => {
    if (!workbook || !selectedSheet) return;

    setIsProcessing(true);
    const processedData: ProcessedData[] = [];
    const errors: string[] = [];

    for (const row of previewData) {
      if (!row.isValid) {
        errors.push(`Skipped row: ${row.address} - ${row.error}`);
        continue;
      }

      try {
        console.log('Querying API for postcode:', row.postcode);
        const { data: response, error: functionError } = await supabase.functions.invoke('get-floor-area', {
          body: { address: row.postcode }
        });

        if (functionError || response.status === "error") {
          errors.push(`Error fetching data for ${row.address}: ${functionError?.message || response?.message}`);
          continue;
        }

        const propertyData = response.data.properties.find((prop: any) => 
          prop.address.toLowerCase().includes(row.address.toLowerCase())
        );

        if (propertyData) {
          processedData.push({
            address: row.address,
            postcode: row.postcode,
            floor_area_sq_ft: propertyData.floor_area_sq_ft,
            floor_area_sq_m: convertToSquareMeters(propertyData.floor_area_sq_ft),
            habitable_rooms: propertyData.habitable_rooms,
            inspection_date: propertyData.inspection_date
          });
        } else {
          errors.push(`No matching property found for address: ${row.address}`);
        }
      } catch (error) {
        console.error('Error processing address:', row.address, error);
        errors.push(`Error processing ${row.address}: ${error.message}`);
      }
    }

    if (processedData.length > 0) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(processedData);
      XLSX.utils.book_append_sheet(wb, ws, "Processed Data");
      
      const fileName = `processed_data_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Processing Complete",
        description: `Successfully processed ${processedData.length} addresses. The file has been downloaded.`,
      });
    }

    if (errors.length > 0) {
      console.log('Processing errors:', errors);
      toast({
        title: "Some addresses could not be processed",
        description: `${errors.length} errors occurred. Check the console for details.`,
        variant: "destructive",
      });
    }

    setIsProcessing(false);
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

    await processExcelFile(file);
    event.target.value = ''; // Reset the file input
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

      {sheetNames.length > 0 && (
        <div className="w-full max-w-md">
          <Select value={selectedSheet} onValueChange={handleSheetChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a sheet" />
            </SelectTrigger>
            <SelectContent>
              {sheetNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {previewData.length > 0 && (
        <div className="w-full max-w-4xl mt-4">
          <h3 className="text-lg font-semibold mb-2">Data Preview</h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Postcode</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.slice(0, 10).map((row, index) => (
                  <TableRow key={index} className={row.isValid ? '' : 'bg-red-50'}>
                    <TableCell>{row.address}</TableCell>
                    <TableCell>{row.postcode}</TableCell>
                    <TableCell>
                      {row.isValid ? (
                        <span className="text-green-600">Valid</span>
                      ) : (
                        <span className="text-red-600">{row.error}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-4 flex justify-center">
            <Button
              onClick={processData}
              disabled={isProcessing}
              className="bg-estate-600 hover:bg-estate-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Processing...
                </>
              ) : (
                'Process Data'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelProcessor;