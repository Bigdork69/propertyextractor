import { useState } from "react";
import * as XLSX from 'xlsx';
import { useToast } from "./use-toast";
import { PreviewData, ProcessedData } from "@/types/excel";
import { supabase } from "@/integrations/supabase/client";
import { convertToSquareMeters } from "@/utils/propertyUtils";
import { processExcelData, validateRow } from "@/utils/excelUtils";

export const useExcelProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const { toast } = useToast();

  const generatePreview = (worksheet: XLSX.WorkSheet) => {
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    const preview: PreviewData[] = [];

    for (const row of jsonData) {
      const rowData = row as any;
      // Check for various possible column names
      const address = rowData['Address'] || rowData['ADDRESS'] || rowData['address'] || '';
      const postcode = rowData['Post Code'] || rowData['POST CODE'] || rowData['Postcode'] || rowData['POSTCODE'] || rowData['postcode'] || '';
      
      // Skip empty rows
      if (!address && !postcode) continue;
      
      const validation = validateRow(address, postcode);
      
      if (validation.isValid) {
        console.log('Valid row found:', { address, postcode });
      }

      preview.push({
        address,
        postcode,
        isValid: validation.isValid,
        error: validation.error
      });
    }

    setPreviewData(preview.filter(row => row.address || row.postcode));
  };

  const processExcelFile = async (file: File) => {
    try {
      console.log('Processing Excel file:', file.name);
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
    console.log('Changing to sheet:', sheetName);
    setSelectedSheet(sheetName);
    if (workbook) {
      generatePreview(workbook.Sheets[sheetName]);
    }
  };

  const findBestMatch = (propertyList: any[], searchAddress: string, searchPostcode: string) => {
    // Normalize the search address
    const normalizedSearch = searchAddress.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // First try exact match
    let match = propertyList.find(prop => 
      prop.address.toLowerCase() === normalizedSearch
    );

    // If no exact match, try fuzzy match
    if (!match) {
      match = propertyList.find(prop => {
        const propAddress = prop.address.toLowerCase();
        // Check if the main parts of the address match
        const addressParts = normalizedSearch.split(',').map(part => part.trim());
        return addressParts.every(part => propAddress.includes(part.toLowerCase()));
      });
    }

    console.log('Address matching result:', {
      searchAddress: normalizedSearch,
      searchPostcode,
      found: !!match,
      matchedAddress: match?.address
    });

    return match;
  };

  const processData = async () => {
    if (!workbook || !selectedSheet) return;

    setIsProcessing(true);
    const processedData: ProcessedData[] = [];
    const errors: string[] = [];

    for (const row of previewData) {
      if (!row.isValid) {
        errors.push(`Invalid row: ${row.address} - ${row.error}`);
        continue;
      }

      try {
        console.log('Processing address:', row.address, 'with postcode:', row.postcode);
        
        const { data: response, error: functionError } = await supabase.functions.invoke('get-floor-area', {
          body: { 
            address: row.address,
            postcode: row.postcode 
          }
        });

        if (functionError) {
          console.error('Supabase function error:', functionError);
          errors.push(`Error fetching data for ${row.address}: ${functionError.message}`);
          continue;
        }

        if (response.status === "error") {
          console.error('API response error:', response);
          errors.push(`Error: ${response.message} for address: ${row.address}`);
          continue;
        }

        const propertyData = findBestMatch(response.data.properties, row.address, row.postcode);

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
          const error = `No matching property found for address: ${row.address}`;
          console.error(error);
          errors.push(error);
        }
      } catch (error) {
        console.error('Error processing row:', error);
        errors.push(`Error processing ${row.address}: ${(error as Error).message}`);
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
        title: `${errors.length} addresses could not be processed`,
        description: "Check the console for detailed error messages.",
        variant: "destructive",
      });
    }

    setIsProcessing(false);
  };

  return {
    isProcessing,
    previewData,
    selectedSheet,
    sheetNames,
    processExcelFile,
    handleSheetChange,
    processData
  };
};