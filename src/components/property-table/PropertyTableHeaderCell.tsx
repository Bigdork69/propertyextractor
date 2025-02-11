
import { TableHead } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpDown, HelpCircle } from "lucide-react";
import { PropertyData } from "@/types/property";

interface PropertyTableHeaderCellProps {
  label: string;
  tooltip: string;
  sortKey: keyof PropertyData;
  onSort: (key: keyof PropertyData) => void;
}

export const PropertyTableHeaderCell = ({
  label,
  tooltip,
  sortKey,
  onSort,
}: PropertyTableHeaderCellProps) => {
  return (
    <TableHead 
      className="text-right text-white font-medium cursor-pointer hover:bg-[#3D3D4A] transition-colors whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="flex items-center justify-end gap-1">
            {label}
            <HelpCircle className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
    </TableHead>
  );
};
