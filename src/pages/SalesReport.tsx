import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackgroundLayout } from "@/components/BackgroundLayout";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar as CalendarIcon, Download, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import nslLogo from "@/assets/nsl-sugars-logo.png";

const SalesReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!fromDate || !toDate) {
      toast({
        title: "Date Range Required",
        description: "Please select both From and To dates",
        variant: "destructive",
      });
      return;
    }

    if (fromDate > toDate) {
      toast({
        title: "Invalid Date Range",
        description: "From date cannot be after To date",
        variant: "destructive",
      });
      return;
    }

    setIsDownloading(true);

    try {
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication Error",
          description: "Please log in again",
          variant: "destructive",
        });
        setIsDownloading(false);
        return;
      }

      // Set time to start of day for fromDate and end of day for toDate
      const fromDateTime = new Date(fromDate);
      fromDateTime.setHours(0, 0, 0, 0);
      
      const toDateTime = new Date(toDate);
      toDateTime.setHours(23, 59, 59, 999);

      // Query sales_table by date range
      const { data: salesData, error } = await supabase
        .from('sales_table')
        .select('*')
        .gte('sale_date', fromDateTime.toISOString())
        .lte('sale_date', toDateTime.toISOString())
        .order('sale_date', { ascending: true });

      if (error) {
        throw error;
      }

      if (!salesData || salesData.length === 0) {
        toast({
          title: "No Data Found",
          description: "No sales records found for the selected date range",
          variant: "destructive",
        });
        setIsDownloading(false);
        return;
      }

/* ---------- FACTORY FORMAT EXCEL ---------- */

const headerRow = [
  "Division",
  "Section",
  "Coupon No",
  "Ryot Number",
  "Ryot Name",
  "Village",
  "Cane Wt",
  "Eligible Qty",
  "Sugar Rate (Per KG)",
  "Amt In Rs"
];

const dataRows = salesData.map((r: any) => [
  r.division,
  r.section,
  r.coupon_no,
  r.ryot_number,
  r.ryot_name,
  r.village,
  r.cane_wt,
  r.sugar_qty,
  r.sugar_rate,
  r.amount
]);

const totalCane = salesData.reduce((s:any,r:any)=>s+(r.cane_wt||0),0);
const totalQty  = salesData.reduce((s:any,r:any)=>s+(r.sugar_qty||0),0);
const totalAmt  = salesData.reduce((s:any,r:any)=>s+(r.amount||0),0);

dataRows.push([
  "TOTAL","","","","","",
  totalCane,totalQty,"",totalAmt
]);

const sheetData = [
  ["NSL SUGARS LTD., KOPPA UNIT"],
  ["Ryot Sugar Coupon Statement for Crushing Season -2425M"],
  [],
  headerRow,
  ...dataRows
];

const ws = XLSX.utils.aoa_to_sheet(sheetData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sales Report");

ws["!cols"] = [
  { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
  { wch: 20 }, { wch: 18 }, { wch: 12 },
  { wch: 12 }, { wch: 16 }, { wch: 12 }
];


      // Generate filename with date range
      const filename = `sales_report_${format(fromDate, 'yyyy-MM-dd')}_to_${format(toDate, 'yyyy-MM-dd')}.xlsx`;
      
      // Download file
      XLSX.writeFile(wb, filename);

      toast({
        title: "Download Complete",
        description: `Sales report with ${salesData.length} records downloaded successfully`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export sales report",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <BackgroundLayout>
      <div className="min-h-screen p-4 md:p-8">
        {/* Header */}
        <GlassCard className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={nslLogo} alt="NSL Sugars" className="h-8" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Sales Report</h1>
              <p className="text-sm text-muted-foreground">Download sales data as Excel</p>
            </div>
          </div>
        </GlassCard>

        <div className="max-w-2xl mx-auto">
          <GlassCard className="p-8">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="p-4 rounded-2xl bg-chart-2/20 mb-4">
                <FileSpreadsheet className="h-12 w-12 text-chart-2" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Generate Sales Report</h2>
              <p className="text-muted-foreground">
                Select a date range to download the sales report in Excel format
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <Label className="mb-2 block">From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background/50",
                        !fromDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? format(fromDate, "PPP") : "Select start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fromDate}
                      onSelect={setFromDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="mb-2 block">To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background/50",
                        !toDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? format(toDate, "PPP") : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={toDate}
                      onSelect={setToDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Button 
              onClick={handleDownload} 
              className="w-full" 
              size="lg"
              disabled={isDownloading}
            >
              {isDownloading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Generating Report...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Excel
                </span>
              )}
            </Button>

            {fromDate && toDate && fromDate <= toDate && (
              <div className="mt-6 p-4 rounded-lg bg-accent/50 border border-accent">
                <p className="text-sm text-center text-accent-foreground">
                  Report will include data from{" "}
                  <strong>{format(fromDate, "dd MMM yyyy")}</strong> to{" "}
                  <strong>{format(toDate, "dd MMM yyyy")}</strong>
                </p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default SalesReport;
