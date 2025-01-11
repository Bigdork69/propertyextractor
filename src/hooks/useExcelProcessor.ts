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

  const normalizeAddress = (address: string): string => {
    console.log('Normalizing address:', address);
    
    // First, extract just the house number and street name
    const parts = address
      .toLowerCase()
      .replace(/[.,]/g, '') // Remove punctuation
      .split(',')
      .map(part => part.trim());

    // Find the part that contains the house number and street name
    const streetPart = parts.find(part => /\d+.*(?:street|road|close|avenue|lane|way)/i.test(part));
    const townPart = parts.find(part => part === 'antingham');

    const relevantParts = [];
    if (streetPart) relevantParts.push(streetPart);
    if (townPart) relevantParts.push(townPart);

    const normalized = relevantParts
      .join(' ')
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/^(flat|apartment|apt|unit)\s*(\d+)/i, 'flat $2') // Normalize flat numbers
      .replace(/(\d+)[a-z]?\s*(st|nd|rd|th)\s+floor/i, '$1 floor') // Normalize floor numbers
      .replace(/\b(ground|first|second|third|fourth|fifth)\s+floor\b/i, '') // Remove floor descriptions
      .replace(/\b(basement|lower)\s+floor\b/i, '') // Remove basement descriptions
      .trim();

    console.log('Normalized result:', normalized);
    return normalized;
  };

  const findBestMatch = (propertyList: any[], searchAddress: string) => {
    console.log('Finding best match for:', searchAddress);
    
    // Remove North Walsham and postcode from search address
    const cleanedAddress = searchAddress.replace(/,\s*North\s+Walsham\s*,.*$/i, '');
    console.log('Cleaned address for matching:', cleanedAddress);
    
    const normalizedSearch = normalizeAddress(cleanedAddress);
    console.log('Normalized search address:', normalizedSearch);
    
    // Try exact match first
    let match = propertyList.find(prop => {
      const normalizedProp = normalizeAddress(prop.address);
      console.log('Comparing with normalized property:', normalizedProp);
      return normalizedProp === normalizedSearch;
    });

    if (match) {
      console.log('Found exact match:', match.address);
      return match;
    }

    // Try partial match if no exact match found
    match = propertyList.find(prop => {
      const normalizedProp = normalizeAddress(prop.address);
      
      // Extract key components (number and street name)
      const propComponents = normalizedProp.split(' ');
      const searchComponents = normalizedSearch.split(' ');
      
      // Check if house number and street name match
      const hasMatchingNumber = propComponents[0] === searchComponents[0];
      const hasMatchingStreet = searchComponents.slice(1).every(part => 
        propComponents.includes(part)
      );

      const isMatch = hasMatchingNumber && hasMatchingStreet;
      
      console.log('Partial match check:', {
        normalizedProp,
        propComponents,
        searchComponents,
        hasMatchingNumber,
        hasMatchingStreet,
        isMatch
      });
      
      return isMatch;
    });

    if (match) {
      console.log('Found partial match:', match.address);
    } else {
      console.log('No match found for address:', searchAddress);
    }

    return match;
  };

  const generatePreview = (worksheet: XLSX.WorkSheet) => {
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    const preview: PreviewData[] = [];

    for (const row of jsonData) {
      const rowData = row as any;
      const address = rowData['Address'] || rowData['ADDRESS'] || rowData['address'] || '';
      const postcode = rowData['Post Code'] || rowData['POST CODE'] || rowData['Postcode'] || rowData['POSTCODE'] || rowData['postcode'] || '';
      
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
        // Remove North Walsham from API search
        const searchAddress = `${row.address}, ${row.postcode}`.replace(/,\s*North\s+Walsham\s*,/i, ',').trim();
        console.log('Processing address:', searchAddress);
        
        const { data: response, error: functionError } = await supabase.functions.invoke('get-floor-area', {
          body: { 
            address: searchAddress
          }
        });

        if (functionError) {
          const errorMessage = `Error fetching data for ${searchAddress}: ${functionError.message}`;
          console.error('Supabase function error:', errorMessage);
          errors.push(errorMessage);
          continue;
        }

        if (response.status === "error") {
          const errorMessage = `API Error: ${response.message} for address: ${searchAddress}`;
          console.error('API response error:', errorMessage);
          errors.push(errorMessage);
          continue;
        }

        if (!response.data?.properties?.length) {
          const errorMessage = `No properties found for address: ${searchAddress}`;
          console.error(errorMessage);
          errors.push(errorMessage);
          continue;
        }

        const propertyData = findBestMatch(response.data.properties, row.address);

        if (propertyData) {
          processedData.push({
            address: row.address,
            postcode: row.postcode,
            floor_area_sq_ft: propertyData.floor_area_sq_ft,
            floor_area_sq_m: convertToSquareMeters(propertyData.floor_area_sq_ft),
            habitable_rooms: propertyData.habitable_rooms,
            inspection_date: propertyData.inspection_date
          });
          console.log('Successfully processed:', searchAddress);
        } else {
          const errorMessage = `No matching property found for address: ${searchAddress}. Available properties: ${
            response.data.properties.map((p: any) => p.address).join(', ')
          }`;
          console.error(errorMessage);
          errors.push(errorMessage);
        }
      } catch (error) {
        const errorMessage = `Error processing ${row.address}: ${(error as Error).message}`;
        console.error('Processing error:', errorMessage);
        errors.push(errorMessage);
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