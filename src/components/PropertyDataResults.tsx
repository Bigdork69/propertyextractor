import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

interface PropertyData {
  address: string;
  floor_area_sq_ft: number;
  habitable_rooms: number;
  inspection_date: string;
}

interface PropertyDataResultsProps {
  data: PropertyData[] | null;
  isLoading: boolean;
  error: string | null;
}

const PropertyDataResults = ({ data, isLoading, error }: PropertyDataResultsProps) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-estate-800"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-estate-600">
        <p>{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-estate-600">
        <p>No floor area data is available for the provided postcode. Please try another one.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-estate-200 mt-8">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Address</TableHead>
            <TableHead className="text-right">Floor Area (Square Feet)</TableHead>
            <TableHead className="text-right">Habitable Rooms</TableHead>
            <TableHead className="text-right">Inspection Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((property, index) => (
            <TableRow 
              key={`${property.address}-${index}`}
              className="cursor-pointer hover:bg-estate-50"
              onClick={() => console.log('Property selected:', property)}
            >
              <TableCell className="font-medium">{property.address}</TableCell>
              <TableCell className="text-right">{property.floor_area_sq_ft.toLocaleString()}</TableCell>
              <TableCell className="text-right">{property.habitable_rooms}</TableCell>
              <TableCell className="text-right">
                {format(new Date(property.inspection_date), 'yyyy-MM-dd')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default PropertyDataResults;