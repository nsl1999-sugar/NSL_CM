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
import nslLogo from "@/assets/nsl-sugars-logo.png";

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
  // PARSE EXCEL WITH CORRECT COLUMN MAPPING
  // ----------------------------------------
  const parseExcelFile = async (file: File): Promise<FarmerRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];

          const sheetData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
            raw: false,
          }) as any[][];

          if (!sheetData.length) return reject(new Error("Empty Excel file"));

          const rows: FarmerRow[] = [];
          const seen = new Set<string>();

          for (let i = 1; i < sheetData.length; i++) {
            const row = sheetData[i];
            if (!row || row.every((c) => !c)) continue;

            const ryot_number = String(row[4] || "").trim();
            if (!ryot_number) continue;
            if (seen.has(ryot_number)) continue;

            seen.add(ryot_number);

            rows.push({
              coupon_no: String(row[3] || "").trim(),
              division: String(row[1] || "").trim(),
              section: String(row[2] || "").trim(),
              ryot_number,
              ryot_name: String(row[5] || "").trim(),
              father_name: String(row[6] || "").trim(),
              village: String(row[7] || "").trim(),
              cane_wt: Number(row[8] || 0),
              eligible_qty: Number(row[9] || 0),
              sugar_rate: Number(row[10] || 31.5),
              amount: Number(row[11] || 0),
            });
          }

          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };

      reader.readAsArrayBuffer(file);
    });
  };

  // ----------------------------------------
  // HANDLE RESET + INSERT
  // ----------------------------------------
  const handleBackupResponse = async (downloadBackup: boolean) => {
    if (!selectedFile) return;

    setShowBackupModal(false);
    setIsUploading(true);

    try {
      if (downloadBackup) {
        const { data } = await supabase.from("sales_table").select("*");
        if (data && data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "SalesBackup");
          XLSX.writeFile(wb, "sales_backup.xlsx");
        }
      }

      const farmers = await parseExcelFile(selectedFile);
      if (!farmers.length) throw new Error("No valid records to upload.");

      const { error: resetError } = await supabase.rpc("reset_farmers_and_sales");
      if (resetError) throw new Error(resetError.message);

      const batchSize = 800;
      for (let i = 0; i < farmers.length; i += batchSize) {
        const batch = farmers.slice(i, i + batchSize);

        const { error: insertError } = await supabase.from("farmers_table").insert(batch);
        if (insertError) throw new Error(insertError.message);
      }

      toast({
        title: "Upload Successful",
        description: `${farmers.length} records uploaded successfully.`,
      });

      setSelectedFile(null);

    } catch (err: any) {
      toast({
        title: "Upload Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // ----------------------------------------
  // COMPONENT UI
  // ----------------------------------------
  return (
    <BackgroundLayout>
      <div className="min-h-screen p-4 md:p-8">
        <GlassCard className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <img src={nslLogo} className="h-8" />
            <div>
              <h1 className="text-xl font-bold">Upload Excel</h1>
              <p className="text-sm text-muted-foreground">Upload new season data</p>
            </div>
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


            <Button
              onClick={handleUpload}
              className="w-full mt-6"
              size="lg"
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? "Uploading..." : "Upload File"}
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
