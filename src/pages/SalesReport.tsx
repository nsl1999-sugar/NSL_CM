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

/* ----------------- EXCEL STYLES ----------------- */
const headerStyle = {
  font: { bold: true },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  },
};

const cellStyle = {
  alignment: { horizontal: "center", vertical: "center" },
  border: {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  },
};

const SalesReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!fromDate || !toDate) {
      toast({ title: "Select Date Range", variant: "destructive" });
      return;
    }

    setIsDownloading(true);

    try {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      /* ✅ SALES TABLE ONLY */
      const { data, error } = await supabase
        .from("sales_table")
        .select("*")
        .gte("sale_date", from.toISOString())
        .lte("sale_date", to.toISOString())
        .order("sale_date", { ascending: true });

      if (error || !data || data.length === 0) {
        throw new Error("No sales data");
      }

      /* ✅ HEADER ROW */
      const headers = [
        "Division",
        "Section",
        "Coupon No",
        "Ryot Number",
        "Ryot Name",
        "Village",
        "Cane Wt",
        "Eligible Qty",
        "Sugar Rate (Per KG)",
        "Amt In Rs",
      ];

      /* ✅ DATA ROWS */
      const rows = data.map((r: any) => [
        r.division,
        r.section,
        r.coupon_no,
        r.ryot_number,
        r.ryot_name,
        r.village,
        r.cane_wt,
        r.sugar_qty,
        r.sugar_rate,
        r.amount,
      ]);

      /* ✅ TOTALS */
      const totalCane = data.reduce((s, r: any) => s + (r.cane_wt || 0), 0);
      const totalQty = data.reduce((s, r: any) => s + (r.sugar_qty || 0), 0);
      const totalAmt = data.reduce((s, r: any) => s + (r.amount || 0), 0);

      rows.push([
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        totalCane,
        totalQty,
        "",
        totalAmt,
      ]);

      /* ✅ CREATE SHEET */
      const sheet = XLSX.utils.aoa_to_sheet([]);

      XLSX.utils.sheet_add_aoa(sheet, [
        ["NSL SUGARS LTD., KOPPA UNIT"],
        ["Ryot Sugar Coupon Statement for Crushing Season -2425M"],
        [""],
        headers,
        ...rows,
      ]);

      /* ✅ APPLY STYLES */
      const range = XLSX.utils.decode_range(sheet["!ref"]!);

      for (let C = range.s.c; C <= range.e.c; C++) {
        sheet[XLSX.utils.encode_cell({ r: 3, c: C })].s = headerStyle;
      }

      for (let R = 4; R <= range.e.r; R++) {
        for (let C = 0; C <= range.e.c; C++) {
          const ref = XLSX.utils.encode_cell({ r: R, c: C });
          if (sheet[ref]) sheet[ref].s = cellStyle;
        }
      }

      sheet["!cols"] = [
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
        { wch: 20 }, { wch: 20 }, { wch: 15 },
        { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 12 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Sales Report");

      XLSX.writeFile(wb, "Ryot_Sugar_Coupon_Statement.xlsx");

      toast({ title: "Excel Generated Successfully ✅" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <BackgroundLayout>
      <div className="min-h-screen p-4 md:p-8">
        <GlassCard className="p-4 mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={nslLogo} className="h-8" />
          <h1 className="text-xl font-bold">Sales Report</h1>
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
