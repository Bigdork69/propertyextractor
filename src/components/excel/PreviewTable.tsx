import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PreviewData } from "@/types/excel";

interface PreviewTableProps {
  data: PreviewData[];
}

const PreviewTable = ({ data }: PreviewTableProps) => {
  return (
    <div className="w-full max-w-4xl mt-4">
      <h3 className="text-lg font-semibold mb-2">Data Preview</h3>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Address</TableHead>
              <TableHead>Postcode</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 10).map((row, index) => (
              <TableRow key={index} className={row.isValid ? '' : 'bg-red-50'}>
                <TableCell>{row.address}</TableCell>
                <TableCell>{row.postcode}</TableCell>
                <TableCell>
                  {row.isValid ? (
                    <span className="text-green-600">Valid</span>
                  ) : (
                    <span className="text-red-600">{row.error}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PreviewTable;