import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ArrowUpDown, HelpCircle } from "lucide-react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PropertyData {
  address: string;
  floor_area_sq_ft: number | null;
  floor_area_sq_m: number | null;
  habitable_rooms: number;
  inspection_date: string;
  price_per_sq_ft?: number | null;
  price_per_sq_m?: number | null;
  estimated_value?: number | null;
  pricing_date?: string | null;
  transaction_count?: number | null;
}

interface PropertyDataResultsProps {
  data: PropertyData[] | null;
  isLoading: boolean;
  error: string | null;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
};

const PropertyDataResults = ({ data, isLoading, error }: PropertyDataResultsProps) => {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof PropertyData;
    direction: 'asc' | 'desc';
  } | null>(null);

  const sortData = (key: keyof PropertyData) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
  };

  const getSortedData = () => {
    if (!data || !sortConfig) return data;

    return [...data].sort((a, b) => {
      if (a[sortConfig.key] === null) return 1;
      if (b[sortConfig.key] === null) return -1;
      
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8 mt-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-estate-800"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 mt-8 text-estate-600">
        <p>{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 mt-8 text-estate-600">
        <p>No floor area data is available for the provided postcode. Please try another one.</p>
      </div>
    );
  }

  const sortedData = getSortedData();

  return (
    <div className="w-full mt-8">
      <div className="max-w-[1200px] mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#2D2D3A] sticky top-0">
              <TableRow className="hover:bg-[#2D2D3A]/90 transition-colors">
                <TableHead 
                  className="text-white font-medium cursor-pointer hover:bg-[#3D3D4A] transition-colors whitespace-nowrap"
                  onClick={() => sortData('address')}
                >
                  Address
                  <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                </TableHead>
                <TableHead 
                  className="text-right text-white font-medium cursor-pointer hover:bg-[#3D3D4A] transition-colors whitespace-nowrap"
                  onClick={() => sortData('floor_area_sq_ft')}
                >
                  Floor Area (Square Feet)
                  <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                </TableHead>
                <TableHead 
                  className="text-right text-white font-medium cursor-pointer hover:bg-[#3D3D4A] transition-colors whitespace-nowrap"
                  onClick={() => sortData('floor_area_sq_m')}
                >
                  Floor Area (Square Meters)
                  <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                </TableHead>
                <TableHead 
                  className="text-right text-white font-medium cursor-pointer hover:bg-[#3D3D4A] transition-colors whitespace-nowrap"
                  onClick={() => sortData('price_per_sq_ft')}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center justify-end gap-1">
                        Price per Sq Ft
                        <HelpCircle className="h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Average price per square foot in the area</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                </TableHead>
                <TableHead 
                  className="text-right text-white font-medium cursor-pointer hover:bg-[#3D3D4A] transition-colors whitespace-nowrap"
                  onClick={() => sortData('estimated_value')}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center justify-end gap-1">
                        Estimated Value
                        <HelpCircle className="h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Estimated value based on floor area and local price per square foot</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                </TableHead>
                <TableHead 
                  className="text-right text-white font-medium cursor-pointer hover:bg-[#3D3D4A] transition-colors whitespace-nowrap"
                  onClick={() => sortData('habitable_rooms')}
                >
                  Habitable Rooms
                  <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                </TableHead>
                <TableHead 
                  className="text-right text-white font-medium cursor-pointer hover:bg-[#3D3D4A] transition-colors whitespace-nowrap"
                  onClick={() => sortData('inspection_date')}
                >
                  Inspection Date
                  <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData?.map((property, index) => (
                <TableRow 
                  key={`${property.address}-${index}`}
                  className={`
                    cursor-pointer 
                    transition-colors
                    ${index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}
                  `}
                >
                  <TableCell className="font-medium text-gray-900 whitespace-nowrap">{property.address}</TableCell>
                  <TableCell className="text-right text-gray-700 whitespace-nowrap">
                    {property.floor_area_sq_ft ? property.floor_area_sq_ft.toLocaleString() : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right text-gray-700 whitespace-nowrap">
                    {property.floor_area_sq_m ? property.floor_area_sq_m.toLocaleString() : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right text-gray-700 whitespace-nowrap">
                    {formatCurrency(property.price_per_sq_ft)}
                  </TableCell>
                  <TableCell className="text-right text-gray-700 whitespace-nowrap">
                    {formatCurrency(property.estimated_value)}
                  </TableCell>
                  <TableCell className="text-right text-gray-700 whitespace-nowrap">{property.habitable_rooms}</TableCell>
                  <TableCell className="text-right text-gray-700 whitespace-nowrap">
                    {format(new Date(property.inspection_date), 'yyyy-MM-dd')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default PropertyDataResults;