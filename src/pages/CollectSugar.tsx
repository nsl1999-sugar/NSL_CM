import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BackgroundLayout } from "@/components/BackgroundLayout";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Check, CreditCard, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabase";
import nslLogo from "@/assets/nsl-sugars-logo.png";

interface FarmerEntry {
  couponNo: string;
  ryotNo: string;
  name: string;
  eligibleQty: number;
  sugarRate: number;
  amount: number;
  status: "NEW" | "ALREADY COLLECTED";
}

const DEFAULT_RATE = 31.5;

const formatSupabaseError = (message?: string) => {
  if (!message) return "Unexpected error. Please try again.";
  return message.toLowerCase().includes("permission")
    ? "Permission denied. Please review Supabase Row Level Security policies."
    : message;
};

const CollectSugar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchValue, setSearchValue] = useState("");
  const [entries, setEntries] = useState<FarmerEntry[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr">("cash");
  const [isAdding, setIsAdding] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleAdd = async () => {
    const lookupValue = searchValue.trim();
    if (!lookupValue) {
      toast({
        title: "Error",
        description: "Please enter a Coupon No or Ryot Number",
        variant: "destructive",
      });
      return;
    }
    const normalizedLookup = lookupValue.toLowerCase();

    try {
      setIsAdding(true);
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication Error",
          description: "Please log in again",
          variant: "destructive",
        });
        setIsAdding(false);
        return;
      }

      // Prevent duplicates by coupon or ryot number
      const duplicate = entries.find((entry) => {
        const ryotMatch = entry.ryotNo && entry.ryotNo.toLowerCase() === normalizedLookup;
        const couponMatch = entry.couponNo && entry.couponNo.toLowerCase() === normalizedLookup;
        return ryotMatch || couponMatch;
      });

      if (duplicate) {
        toast({
          title: "Duplicate Entry",
          description: "This farmer is already in the collection list.",
          variant: "destructive",
        });
        setIsAdding(false);
        return;
      }

      // Query farmer by ryot number first, then coupon number
      const fetchFarmer = async () => {
        const { data, error } = await supabase
          .from("farmers_table")
          .select("*")
          .eq("ryot_number", lookupValue)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          return data;
        }

        const { data: couponMatch, error: couponError } = await supabase
          .from("farmers_table")
          .select("*")
          .eq("coupon_no", lookupValue)
          .maybeSingle();

        if (couponError) {
          throw couponError;
        }

        return couponMatch;
      };

      const farmer = await fetchFarmer();

      if (!farmer) {
        toast({
          title: "Not Found",
          description: "No farmer found with the provided coupon/ryot number.",
          variant: "destructive",
        });
        setIsAdding(false);
        return;
      }

      // Check if the farmer already collected sugar
      const { data: saleRecord, error: saleError } = await supabase
        .from("sales_table")
        .select("id")
        .eq("ryot_number", farmer.ryot_number)
        .maybeSingle();

      if (saleError) {
        throw saleError;
      }

      const eligibleQty = farmer.eligible_qty || 0;
      const sugarRate = farmer.sugar_rate || DEFAULT_RATE;
      const amount = farmer.amount || parseFloat((eligibleQty * sugarRate).toFixed(2));

      const newEntry: FarmerEntry = {
        couponNo: farmer.coupon_no || "",
        ryotNo: farmer.ryot_number || "",
        name: farmer.ryot_name || "Unknown",
        eligibleQty,
        sugarRate,
        amount,
        status: saleRecord ? "ALREADY COLLECTED" : "NEW",
      };

      setEntries((prev) => [...prev, newEntry]);
      setSearchValue("");

      toast({
        title: saleRecord ? "Already Collected" : "Farmer Added",
        description: saleRecord
          ? `${farmer.ryot_name} has already collected sugar.`
          : `${farmer.ryot_name} added to collection list.`,
        variant: saleRecord ? "destructive" : "default",
      });
    } catch (error: any) {
      console.error("Error adding farmer:", error);
      toast({
        title: "Error",
        description: formatSupabaseError(error?.message),
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleConfirm = async () => {
    const newEntries = entries.filter((entry) => entry.status === "NEW");

    if (newEntries.length === 0) {
      toast({
        title: "No new entries",
        description: "Add at least one new farmer before confirming payment.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsConfirming(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication Error",
          description: "Please log in again",
          variant: "destructive",
        });
        setIsConfirming(false);
        return;
      }

      const ryotNumbers = newEntries.map((entry) => entry.ryotNo);
      const { data: existingSales, error: checkError } = await supabase
        .from("sales_table")
        .select("ryot_number")
        .in("ryot_number", ryotNumbers);

      if (checkError) {
        throw checkError;
      }

      const duplicates = new Set(existingSales?.map((sale) => sale.ryot_number) || []);
      const entriesToInsert = newEntries.filter((entry) => !duplicates.has(entry.ryotNo));

      if (entriesToInsert.length === 0) {
        toast({
          title: "Duplicate entries",
          description: "All selected farmers already have sales recorded.",
          variant: "destructive",
        });
        setIsConfirming(false);
        return;
      }

      const salesRecords = entriesToInsert.map((entry) => ({
coupon_no: entry.couponNo,
  ryot_number: entry.ryotNo,
  ryot_name: entry.name,
  father_name: entry.fatherName,
  village: entry.village,
  division: entry.division,
  section: entry.section,
  cane_wt: entry.caneWt,
  eligible_qty: entry.eligibleQty,
  sugar_rate: entry.sugarRate,
  amount: entry.amount,
  payment_mode: paymentMethod,
  collected_by: session.user.email,
      }));

      const { error: insertError } = await supabase
        .from("sales_table")
        .insert(salesRecords);

      if (insertError) {
        throw insertError;
      }

      toast({
        title: "Payment Confirmed",
        description: `${entriesToInsert.length} sale(s) recorded successfully.`,
      });

      setEntries((prev) =>
        prev.map((entry) =>
          entriesToInsert.find((inserted) => inserted.ryotNo === entry.ryotNo)
            ? { ...entry, status: "ALREADY COLLECTED" }
            : entry
        )
      );
    } catch (error: any) {
      console.error("Error confirming payment:", error);
      toast({
        title: "Payment Failed",
        description: formatSupabaseError(error?.message),
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const totalSugar = useMemo(
    () => entries.filter((entry) => entry.status === "NEW").reduce((sum, entry) => sum + entry.eligibleQty, 0),
    [entries]
  );

  const totalAmount = useMemo(
    () => entries.filter((entry) => entry.status === "NEW").reduce((sum, entry) => sum + entry.amount, 0),
    [entries]
  );

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
              <h1 className="text-xl font-bold text-foreground">Collect Sugar</h1>
              <p className="text-sm text-muted-foreground">Process sugar collection from Ryots</p>
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Section */}
          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold mb-4">Add Farmer</h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="searchValue">Coupon No / Ryot Number</Label>
                <Input
                  id="searchValue"
                  placeholder="Enter coupon or ryot number"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="mt-1 bg-background/50"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>

              <Button onClick={handleAdd} className="w-full" disabled={isAdding}>
                {isAdding ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Searching...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Farmer
                  </span>
                )}
              </Button>

              <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                Enter any coupon number or ryot number to fetch farmer details.
              </div>
            </div>
          </GlassCard>

          {/* Table Section */}
          <GlassCard className="p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Farmers Added</h2>
            
            <div className="rounded-lg border bg-background/30 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Coupon No</TableHead>
                    <TableHead>Ryot No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Eligible Qty (kg)</TableHead>
                    <TableHead className="text-right">Rate (₹)</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No entries added. Enter a coupon or ryot number and click Add.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => (
                      <TableRow key={`${entry.ryotNo || "unknown"}-${entry.couponNo || "coupon"}`}>
                        <TableCell className="font-mono">{entry.couponNo}</TableCell>
                        <TableCell className="font-mono">{entry.ryotNo}</TableCell>
                        <TableCell>{entry.name}</TableCell>
                        <TableCell className="text-right">{entry.eligibleQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{entry.sugarRate.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{entry.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          {entry.status === "ALREADY COLLECTED" ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-destructive/20 text-destructive-foreground">
                              ALREADY COLLECTED
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                              NEW
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {entries.length > 0 && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm font-medium text-muted-foreground">Total Sugar (NEW)</p>
                  <p className="text-2xl font-semibold text-primary">{totalSugar.toFixed(2)} kg</p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm font-medium text-muted-foreground">Total Amount (NEW)</p>
                  <p className="text-2xl font-semibold text-primary">₹{totalAmount.toFixed(2)}</p>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Payment Section */}
        {entries.some(e => e.status === "NEW") && (
          <GlassCard className="p-6 mt-6">
            <h2 className="text-lg font-semibold mb-4">Payment Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <Label className="mb-2 block">Payment Method</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as "cash" | "qr")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="cursor-pointer flex items-center gap-1">
                      <CreditCard className="h-4 w-4" />
                      Cash
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="qr" id="qr" />
                    <Label htmlFor="qr" className="cursor-pointer flex items-center gap-1">
                      <QrCode className="h-4 w-4" />
                      QR
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Total to collect</p>
                <p className="text-2xl font-semibold text-foreground">₹{totalAmount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Sugar Qty: {totalSugar.toFixed(2)} kg</p>
              </div>

              <Button onClick={handleConfirm} size="lg" disabled={isConfirming}>
                {isConfirming ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Recording...
                  </span>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirm Payment
                  </>
                )}
              </Button>
            </div>
          </GlassCard>
        )}
      </div>
    </BackgroundLayout>
  );
};

export default CollectSugar;
