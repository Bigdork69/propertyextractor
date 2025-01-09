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
      const address = rowData['Address'] || rowData['ADDRESS'] || '';
      const postcode = rowData['Post Code'] || rowData['POST CODE'] || rowData['Postcode'] || rowData['POSTCODE'] || '';
      
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
        title: "Some addresses could not be processed",
        description: `${errors.length} errors occurred. Check the console for details.`,
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