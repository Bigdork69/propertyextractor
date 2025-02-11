
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { PropertyData } from "@/types/property";
import { PropertyDataResultsProps, SortConfig } from "@/types/property-table";
import { getSortedData } from "@/utils/table-utils";
import { PropertyTableHeaderCell } from "./property-table/PropertyTableHeaderCell";
import { PropertyTableRow } from "./property-table/PropertyTableRow";

const COLUMN_DEFINITIONS = [
  {
    label: "Address",
    tooltip: "Full property address including house number and street name",
    key: "address" as keyof PropertyData,
  },
  {
    label: "Floor Area (Square Feet)",
    tooltip: "Total floor area of the property measured in square feet from EPC data",
    key: "floor_area_sq_ft" as keyof PropertyData,
  },
  {
    label: "Floor Area (Square Meters)",
    tooltip: "Total floor area of the property measured in square meters, converted from square feet",
    key: "floor_area_sq_m" as keyof PropertyData,
  },
  {
    label: "Price per Sq Ft",
    tooltip: "Average sold price per square foot based on recent transactions in the area",
    key: "price_per_sq_ft" as keyof PropertyData,
  },
  {
    label: "Price per Sq M",
    tooltip: "Average sold price per square meter based on recent transactions in the area",
    key: "price_per_sq_m" as keyof PropertyData,
  },
  {
    label: "Estimated Value",
    tooltip: "Estimated property value calculated using the floor area and local price per square foot",
    key: "estimated_value" as keyof PropertyData,
  },
  {
    label: "Habitable Rooms",
    tooltip: "Number of habitable rooms excluding bathrooms, toilets, halls, and storage spaces",
    key: "habitable_rooms" as keyof PropertyData,
  },
  {
    label: "Inspection Date",
    tooltip: "Date when the property was last inspected for the EPC assessment",
    key: "inspection_date" as keyof PropertyData,
  },
];

const PropertyDataResults = ({ data, isLoading, error }: PropertyDataResultsProps) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const sortData = (key: keyof PropertyData) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
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

  const sortedData = getSortedData(data, sortConfig);

  return (
    <div className="w-full mt-8">
      <div className="max-w-[1200px] mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#2D2D3A] sticky top-0">
              <TableRow className="hover:bg-[#2D2D3A]/90 transition-colors">
                {COLUMN_DEFINITIONS.map((column) => (
                  <PropertyTableHeaderCell
                    key={column.key}
                    label={column.label}
                    tooltip={column.tooltip}
                    sortKey={column.key}
                    onSort={sortData}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData?.map((property, index) => (
                <PropertyTableRow
                  key={`${property.address}-${index}`}
                  property={property}
                  index={index}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default PropertyDataResults;
