
import { TableCell, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { PropertyData } from "@/types/property";
import { formatCurrency } from "@/utils/table-utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface PropertyTableRowProps {
  property: PropertyData;
  index: number;
}

const getConfidenceBadgeColor = (level: string | undefined) => {
  switch (level) {
    case 'High':
      return 'bg-green-500 hover:bg-green-600';
    case 'Medium':
      return 'bg-yellow-500 hover:bg-yellow-600';
    case 'Low':
      return 'bg-red-500 hover:bg-red-600';
    default:
      return 'bg-gray-500 hover:bg-gray-600';
  }
};

export const PropertyTableRow = ({ property, index }: PropertyTableRowProps) => {
  const priceRange = property.lower_bound_value && property.upper_bound_value
    ? `${formatCurrency(property.lower_bound_value)} - ${formatCurrency(property.upper_bound_value)}`
    : 'N/A';

  return (
    <TableRow 
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
        {formatCurrency(property.price_per_sq_m)}
      </TableCell>
      <TableCell className="text-right text-gray-700">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="inline-flex items-center">
              <span className="mr-2">{formatCurrency(property.estimated_value)}</span>
              <HelpCircle className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold">Price Range:</p>
              <p>{priceRange}</p>
              <p className="text-sm text-gray-500 mt-1">
                Based on {property.transaction_count} transactions
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell className="text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge className={`${getConfidenceBadgeColor(property.confidence_level)}`}>
                {property.confidence_level || 'Unknown'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Confidence based on:</p>
              <ul className="text-sm">
                <li>Sample size: {property.transaction_count} transactions</li>
                <li>Data age: {property.data_age_days} days old</li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell className="text-right text-gray-700 whitespace-nowrap">{property.habitable_rooms}</TableCell>
      <TableCell className="text-right text-gray-700 whitespace-nowrap">
        {format(new Date(property.inspection_date), 'yyyy-MM-dd')}
      </TableCell>
    </TableRow>
  );
};
