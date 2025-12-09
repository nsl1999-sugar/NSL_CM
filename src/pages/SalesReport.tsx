import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackgroundLayout } from "@/components/BackgroundLayout";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar as CalendarIcon, Download } from "lucide-react";
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

    setIsDownloading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);

      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      // ✅ SALES TABLE ONLY (CORRECT)
      const { data, error } = await supabase
        .from("sales_table")
        .select("*")
        .gte("sale_date", from.toISOString())
        .lte("sale_date", to.toISOString())
        .order("sale_date", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "No Data",
          description: "No sales found for selected dates",
          variant: "destructive",
        });
        return;
      }

      // ✅ FORMAT EXACT FACTORY EXCEL
      const rows = data.map((r: any) => ({
        Division: r.division,
        Section: r.section,
        "Coupon No": r.coupon_no,
        "Ryot Number": r.ryot_number,
        "Ryot Name": r.ryot_name,
        "Father Name": r.father_name,
        Village: r.village,
        "Cane Wt": r.cane_wt,
        "Eligible Qty": r.sugar_qty,
        "Sugar Rate (Per KG)": r.sugar_rate,
        "Amt In Rs": r.amount,
        "Collected By": r.collected_by,
        "Payment Mode": r.payment_mode,
        Date: format(new Date(r.sale_date), "dd/MM/yyyy HH:mm"),
      }));

      // ✅ TOTALS
      const totalCane = rows.reduce((s, r) => s + (r["Cane Wt"] || 0), 0);
      const totalQty = rows.reduce((s, r) => s + (r["Eligible Qty"] || 0), 0);
      const totalAmt = rows.reduce((s, r) => s + (r["Amt In Rs"] || 0), 0);

      rows.push({
        Division: "TOTAL",
        "Cane Wt": totalCane,
        "Eligible Qty": totalQty,
        "Amt In Rs": totalAmt,
      } as any);

      // ✅ EXCEL STRUCTURE
      const sheet = XLSX.utils.json_to_sheet([], { skipHeader: true });

      XLSX.utils.sheet_add_aoa(sheet, [
        ["NSL SUGARS LTD., KOPPA UNIT"],
        ["Ryot Sugar Coupon Statement for Crushing Season"],
        [""],
      ]);

      XLSX.utils.sheet_add_json(sheet, rows, {
        origin: "A4",
        skipHeader: false,
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Sales Report");

      XLSX.writeFile(
        wb,
        `Ryot_Sugar_Coupon_Statement_${format(fromDate, "dd-MM-yyyy")}_to_${format(
          toDate,
          "dd-MM-yyyy"
        )}.xlsx`
      );

      toast({
        title: "Download Successful",
        description: "Sales report generated successfully",
      });

    } catch (err: any) {
      toast({
        title: "Download Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <BackgroundLayout>
      <div className="min-h-screen p-4 md:p-8">
        <GlassCard className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={nslLogo} alt="NSL Sugars" className="h-8" />
            <h1 className="text-xl font-bold">Sales Report</h1>
          </div>
        </GlassCard>

        <GlassCard className="max-w-2xl mx-auto p-8 space-y-4">
          <Label>From Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start", !fromDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fromDate ? format(fromDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Calendar mode="single" selected={fromDate} onSelect={setFromDate} />
            </PopoverContent>
          </Popover>

          <Label>To Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start", !toDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {toDate ? format(toDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Calendar mode="single" selected={toDate} onSelect={setToDate} />
            </PopoverContent>
          </Popover>

          <Button onClick={handleDownload} disabled={isDownloading} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download Excel
          </Button>
        </GlassCard>
      </div>
    </BackgroundLayout>
  );
};

export default SalesReport;
