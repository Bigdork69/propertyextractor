import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ExcelUploader from "./excel/ExcelUploader";
import PreviewTable from "./excel/PreviewTable";
import { useExcelProcessor } from "@/hooks/useExcelProcessor";

const ExcelProcessor = () => {
  const {
    isProcessing,
    previewData,
    selectedSheet,
    sheetNames,
    processExcelFile,
    handleSheetChange,
    processData
  } = useExcelProcessor();

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
    event.target.value = '';
  };

  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold text-estate-800 mb-2">Bulk Process Addresses</h2>
        <p className="text-estate-600">Upload an Excel file with addresses to get floor area data</p>
      </div>

      <ExcelUploader 
        isProcessing={isProcessing}
        onFileUpload={handleFileUpload}
      />

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
        <>
          <PreviewTable data={previewData} />
          <div className="mt-4 flex justify-center">
            <Button
              onClick={processData}
              disabled={isProcessing}
              className="bg-estate-600 hover:bg-estate-700"
            >
              Process Data
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default ExcelProcessor;