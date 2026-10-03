import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BackgroundLayout } from "@/components/BackgroundLayout";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, FileUp, File, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NslLogo } from "@/components/NslLogo";

interface FarmerRow {
  coupon_no: string;
  division: string;
  section: string;
  ryot_number: string;
  ryot_name: string;
  father_name: string;
  village: string;
  cane_wt: number;
  sugar_rate: number;
  eligible_qty: number;
  amount: number;
}

const UploadExcel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(localStorage.getItem("userRole"));

  const [uploadStatusText, setUploadStatusText] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const isAdmin = (userRole || "").toLowerCase() === "admin";

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast({
            title: "Session Expired",
            description: "Please log in again.",
            variant: "destructive",
          });
          navigate("/");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (error) throw error;
        setUserRole(data?.role || null);
        if (data?.role) localStorage.setItem("userRole", data.role);

      } catch (error: any) {
        toast({
          title: "Unable to verify role",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsRoleLoading(false);
      }
    };

    fetchRole();
  }, [navigate, toast]);

  // ----------------------------------------
  // FILE SELECTION
  // ----------------------------------------
  const handleFileSelect = (file: File) => {
    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx?|csv)$/i)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a valid Excel file.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (!isAdmin) {
      toast({
        title: "Admin only",
        description: "You are not allowed to upload Excel data.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please choose an Excel file to upload.",
        variant: "destructive",
      });
      return;
    }

    setShowBackupModal(true);
  };

  // ----------------------------------------
  // PARSE EXCEL WITH VALIDATED HEADER MAPPING
  // ----------------------------------------
  interface ParseResult {
    validRows: FarmerRow[];
    rejectedRows: { row: number; reason: string }[];
    sheetName: string;
    headerRowIndex: number;
  }

  const parseExcelFile = async (file: File): Promise<ParseResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });

          let targetSheetName = "";
          let targetSheetData: any[][] | null = null;
          let headerRowIndex = -1;
          const headerMap: Record<string, number> = {};

          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            const sheetData = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: "",
              raw: false,
            }) as any[][];

            if (!sheetData || sheetData.length < 5) continue;

            // Search first 20 rows for report header row
            for (let r = 0; r < Math.min(20, sheetData.length); r++) {
              const row = sheetData[r];
              if (!Array.isArray(row)) continue;

              const rowStr = row.map((c) => String(c).trim().toLowerCase()).join(" ");

              if (
                rowStr.includes("division") &&
                (rowStr.includes("ryot") || rowStr.includes("coupon") || rowStr.includes("section"))
              ) {
                headerRowIndex = r;
                targetSheetName = sheetName;
                targetSheetData = sheetData;

                row.forEach((cellVal, colIdx) => {
                  const norm = String(cellVal).trim().toLowerCase().replace(/\s+/g, " ");
                  if (norm.includes("division")) headerMap["division"] = colIdx;
                  else if (norm.includes("section")) headerMap["section"] = colIdx;
                  else if (norm.includes("coupon")) headerMap["coupon_no"] = colIdx;
                  else if (norm.includes("issue")) headerMap["issue_date"] = colIdx;
                  else if (
                    norm.includes("ryot number") ||
                    norm.includes("ryot no") ||
                    norm.includes("ryotnum")
                  )
                    headerMap["ryot_number"] = colIdx;
                  else if (norm.includes("ryot name") || norm.includes("ryotname"))
                    headerMap["ryot_name"] = colIdx;
                  else if (norm.includes("fhname") || norm.includes("father"))
                    headerMap["father_name"] = colIdx;
                  else if (norm.includes("village")) headerMap["village"] = colIdx;
                  else if (norm.includes("cane")) headerMap["cane_wt"] = colIdx;
                  else if (norm.includes("eligible")) headerMap["eligible_qty"] = colIdx;
                  else if (norm.includes("sugar rate") || norm.includes("sugarrate"))
                    headerMap["sugar_rate"] = colIdx;
                  else if (norm.includes("amt") || norm.includes("amount"))
                    headerMap["amount"] = colIdx;
                });
                break;
              }
            }
            if (headerRowIndex !== -1) break;
          }

          if (headerRowIndex === -1 || !targetSheetData) {
            return reject(
              new Error(
                "Could not find valid report header row in Excel. Expected headers like Division, Section, Coupon No, Ryot Number."
              )
            );
          }

          const requiredHeaders = ["ryot_number", "coupon_no", "division", "section"];
          const missing = requiredHeaders.filter((h) => headerMap[h] === undefined);
          if (missing.length > 0) {
            return reject(
              new Error(`Missing required column headers in Excel: ${missing.join(", ")}`)
            );
          }

          const validRows: FarmerRow[] = [];
          const rejectedRows: { row: number; reason: string }[] = [];
          const compositeKeys = new Set<string>();

          for (let i = headerRowIndex + 1; i < targetSheetData.length; i++) {
            const row = targetSheetData[i];
            if (!row || row.every((c) => String(c).trim() === "")) continue;

            const getVal = (key: string) => {
              const idx = headerMap[key];
              return idx !== undefined && row[idx] !== undefined ? String(row[idx]).trim() : "";
            };

            const division = getVal("division");
            const section = getVal("section");
            const coupon_no = getVal("coupon_no");
            const ryot_number = getVal("ryot_number");
            const ryot_name = getVal("ryot_name");
            const father_name = getVal("father_name");
            const village = getVal("village");
            const caneWtStr = getVal("cane_wt");
            const eligibleQtyStr = getVal("eligible_qty");
            const sugarRateStr = getVal("sugar_rate");
            const amountStr = getVal("amount");

            // Skip summary/total row
            if (
              village.toUpperCase() === "TOTAL" ||
              division.toUpperCase() === "TOTAL" ||
              ryot_name.toUpperCase() === "TOTAL"
            ) {
              continue;
            }

            if (!ryot_number || !coupon_no) {
              rejectedRows.push({
                row: i + 1,
                reason: "Missing Ryot Number or Coupon No",
              });
              continue;
            }

            const cane_wt = parseFloat(caneWtStr);
            const eligible_qty = parseFloat(eligibleQtyStr);
            const sugar_rate = parseFloat(sugarRateStr) || 31.5;
            const amount = parseFloat(amountStr);

            if (isNaN(cane_wt) || isNaN(eligible_qty) || isNaN(amount)) {
              rejectedRows.push({
                row: i + 1,
                reason: "Invalid numeric values for cane weight, eligible quantity, or amount",
              });
              continue;
            }

            // Deduplicate by composite identity (ryot_number + coupon_no), preserving multiple valid coupons for same ryot
            const compositeKey = `${ryot_number}_${coupon_no}`;
            if (compositeKeys.has(compositeKey)) {
              rejectedRows.push({
                row: i + 1,
                reason: `Duplicate entry for coupon ${coupon_no} and ryot ${ryot_number}`,
              });
              continue;
            }
            compositeKeys.add(compositeKey);

            validRows.push({
              coupon_no,
              division,
              section,
              ryot_number,
              ryot_name,
              father_name,
              village,
              cane_wt,
              eligible_qty,
              sugar_rate,
              amount,
            });
          }

          resolve({
            validRows,
            rejectedRows,
            sheetName: targetSheetName,
            headerRowIndex,
          });
        } catch (err) {
          reject(err);
        }
      };

      reader.readAsArrayBuffer(file);
    });
  };

  // ----------------------------------------
  // SAFE BACKUP + RESET + BATCH INSERT
  // ----------------------------------------
  const handleBackupResponse = async (downloadBackup: boolean) => {
    if (!selectedFile) return;

    setShowBackupModal(false);
    setIsUploading(true);
    setUploadStatusText("Parsing and validating Excel file...");
    setUploadProgress(0);

    try {
      // Step 1: Parse and validate file FIRST (no DB mutation until validation passes)
      const parseResult = await parseExcelFile(selectedFile);
      const { validRows, rejectedRows } = parseResult;

      if (!validRows.length) {
        throw new Error(
          `No valid records found in Excel file. ${
            rejectedRows.length ? `${rejectedRows.length} rows failed validation.` : ""
          }`
        );
      }

      // Step 2: Download backup if requested
      if (downloadBackup) {
        setUploadStatusText("Exporting data backup...");
        const { data: existingFarmers } = await supabase.from("farmers_table").select("*");
        if (existingFarmers && existingFarmers.length > 0) {
          const ws = XLSX.utils.json_to_sheet(existingFarmers);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "FarmersBackup");
          XLSX.writeFile(wb, "farmers_backup.xlsx");
        }
      }

      // Step 3: Clear old season data via RPC safely ONLY after validation & backup succeed
      setUploadStatusText("Clearing previous season data...");
      const { error: resetError } = await supabase.rpc("reset_farmers_and_sales");
      if (resetError) {
        throw new Error(`Failed to reset season data: ${resetError.message}`);
      }

      // Step 4: Batch insert valid records
      const batchSize = 500;
      const totalBatches = Math.ceil(validRows.length / batchSize);
      let insertedCount = 0;

      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        const currentBatchNum = Math.floor(i / batchSize) + 1;
        setUploadStatusText(
          `Uploading batch ${currentBatchNum} of ${totalBatches} (${batch.length} records)...`
        );
        setUploadProgress(Math.round((i / validRows.length) * 100));

        const { error: insertError } = await supabase.from("farmers_table").insert(batch);
        if (insertError) {
          throw new Error(
            `Error inserting batch ${currentBatchNum}: ${insertError.message}. Upload paused at ${insertedCount} inserted records.`
          );
        }

        insertedCount += batch.length;
      }

      setUploadProgress(100);
      setUploadStatusText("Verifying database insertion count...");

      // Step 5: Verify upload count in database
      const { count: dbCount, error: countError } = await supabase
        .from("farmers_table")
        .select("*", { count: "exact", head: true });

      if (countError) {
        console.warn("Verification count check warning:", countError);
      }

      const countMsg = dbCount !== null ? ` Database verified (${dbCount} total records).` : "";
      const rejectedMsg = rejectedRows.length ? ` ${rejectedRows.length} rows skipped.` : "";

      toast({
        title: "Upload Successful",
        description: `${insertedCount} records successfully uploaded to database.${rejectedMsg}${countMsg}`,
      });

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

    } catch (err: any) {
      console.error("Upload error:", err);
      toast({
        title: "Upload Failed",
        description: err.message || "An error occurred during file processing.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadStatusText("");
      setUploadProgress(0);
    }
  };

  // ----------------------------------------
  // COMPONENT UI
  // ----------------------------------------
  return (
    <BackgroundLayout>
      <div className="min-h-screen p-4 md:p-8">
        <GlassCard className="p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <NslLogo className="h-8" />
              <div>
                <h1 className="text-xl font-bold">Upload Excel</h1>
                <p className="text-sm text-muted-foreground">Upload new season data</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </GlassCard>

        <div className="max-w-2xl mx-auto">
          <GlassCard className="p-8">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="p-4 rounded-2xl bg-chart-4/20 mb-4">
                <FileUp className="h-12 w-12 text-chart-4" />
              </div>
              <h2 className="text-2xl font-bold">Upload Season Data</h2>
              <p className="text-muted-foreground">Upload an Excel file containing ryot data</p>
            </div>

        {/* DROP ZONE */}
        <div
        className={`relative border-2 border-dashed rounded-xl p-8 transition ${
        isDragOver
        ? "border-primary bg-primary/10"
        : "border-border hover:border-primary/50 hover:bg-muted/50"
        }`}
        onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }}
>
  {/* CLICK INPUT */}
  <input
    ref={fileInputRef}
    type="file"
    accept=".xls,.xlsx,.csv"
    className={`absolute inset-0 opacity-0 cursor-pointer ${
      selectedFile ? "z-0" : "z-20"
    }`}
    onChange={(e) => {
      if (e.target.files?.[0]) {
        handleFileSelect(e.target.files[0]);
      }
    }}
  />

  {/* WHEN FILE IS SELECTED */}
  {selectedFile ? (
    <div
      className="flex items-center gap-3 p-4 bg-card/80 border rounded-lg z-10 relative"
      onClick={(e) => e.stopPropagation()}  // Prevents clicking preview from opening file picker
    >
      <File className="h-8 w-8 text-primary" />

      <div>
        <p className="font-medium">{selectedFile.name}</p>
        <p className="text-sm text-muted-foreground">
          {(selectedFile.size / 1024).toFixed(1)} KB
        </p>
      </div>

      {/* X BUTTON / REMOVE FILE */}
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation(); // Prevent triggering input
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  ) : (
    /* WHEN NO FILE */
    <div className="flex flex-col items-center text-center">
      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-lg font-medium">Drag & drop your file</p>
      <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
    </div>
  )}
</div>


            {isUploading && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                  <span>{uploadStatusText || "Processing file..."}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-2 transition-all duration-300 ease-in-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleUpload}
              className="w-full mt-6"
              size="lg"
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {uploadStatusText || "Uploading..."}
                </span>
              ) : (
                "Upload File"
              )}
            </Button>
          </GlassCard>
        </div>

        {/* BEAUTIFUL OLD BACKUP MODAL */}
        <Dialog open={showBackupModal} onOpenChange={setShowBackupModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Download Backup?</DialogTitle>
              <DialogDescription>
                Do you want to download the existing farmer data before resetting the season?
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleBackupResponse(false)}>
                No, Continue
              </Button>
              <Button onClick={() => handleBackupResponse(true)}>Yes, Download</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </BackgroundLayout>
  );
};

export default UploadExcel;
