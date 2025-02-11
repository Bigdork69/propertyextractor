
import { TableCell, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { PropertyData } from "@/types/property";
import { formatCurrency } from "@/utils/table-utils";

interface PropertyTableRowProps {
  property: PropertyData;
  index: number;
}

export const PropertyTableRow = ({ property, index }: PropertyTableRowProps) => {
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
      <TableCell className="text-right text-gray-700 whitespace-nowrap">
        {formatCurrency(property.estimated_value)}
      </TableCell>
      <TableCell className="text-right text-gray-700 whitespace-nowrap">{property.habitable_rooms}</TableCell>
      <TableCell className="text-right text-gray-700 whitespace-nowrap">
        {format(new Date(property.inspection_date), 'yyyy-MM-dd')}
      </TableCell>
    </TableRow>
  );
};
