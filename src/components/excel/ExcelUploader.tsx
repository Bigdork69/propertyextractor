import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";

interface ExcelUploaderProps {
  isProcessing: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ExcelUploader = ({ isProcessing, onFileUpload }: ExcelUploaderProps) => {
  return (
    <div className="flex items-center gap-4">
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={onFileUpload}
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
  );
};

export default ExcelUploader;