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

/* ===================== TYPES ===================== */

interface FarmerEntry {
  division: string;
  section: string;
  couponNo: string;
  ryotNo: string;
  name: string;
  fatherName: string;
  village: string;
  caneWt: number;
  eligibleQty: number;
  sugarRate: number;
  amount: number;
  status: "NEW" | "ALREADY COLLECTED";
}

/* ===================== CONSTANTS ===================== */

const DEFAULT_RATE = 31.5;

const formatSupabaseError = (message?: string) => {
  if (!message) return "Unexpected error.";
  if (message.toLowerCase().includes("permission")) {
    return "Permission denied. Check RLS policies.";
  }
  return message;
};

/* ===================== COMPONENT ===================== */

const CollectSugar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchValue, setSearchValue] = useState("");
  const [entries, setEntries] = useState<FarmerEntry[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr">("cash");
  const [isAdding, setIsAdding] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  /* ===================== ADD FARMER ===================== */

  const handleAdd = async () => {
    const lookup = searchValue.trim();
    if (!lookup) return;

    try {
      setIsAdding(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Not authenticated");

      // prevent duplicates
      if (entries.some(e => e.ryotNo === lookup || e.couponNo === lookup)) {
        toast({ title: "Duplicate Entry", variant: "destructive" });
        return;
      }

      // fetch farmer
      const { data: farmer } = await supabase
        .from("farmers_table")
        .select("*")
        .or(`ryot_number.eq.${lookup},coupon_no.eq.${lookup}`)
        .maybeSingle();

      if (!farmer) {
        toast({ title: "Farmer not found", variant: "destructive" });
        return;
      }

      // check existing sale
      const { data: sold } = await supabase
        .from("sales_table")
        .select("id")
        .eq("ryot_number", farmer.ryot_number)
        .maybeSingle();

      const eligibleQty = farmer.eligible_qty || 0;
      const rate = farmer.sugar_rate || DEFAULT_RATE;

      const entry: FarmerEntry = {
        division: farmer.division,
        section: farmer.section,
        couponNo: farmer.coupon_no,
        ryotNo: farmer.ryot_number,
        name: farmer.ryot_name,
        fatherName: farmer.father_name,
        village: farmer.village,
        caneWt: farmer.cane_wt,
        eligibleQty,
        sugarRate: rate,
        amount: +(eligibleQty * rate).toFixed(2),
        status: sold ? "ALREADY COLLECTED" : "NEW",
      };

      setEntries(prev => [...prev, entry]);
      setSearchValue("");

    } catch (e: any) {
      toast({ title: "Error", description: formatSupabaseError(e.message), variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  /* ===================== CONFIRM PAYMENT ===================== */

  const handleConfirm = async () => {
    const newEntries = entries.filter(e => e.status === "NEW");
    if (newEntries.length === 0) return;

    try {
      setIsConfirming(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Not authenticated");

      const records = newEntries.map(e => ({
        division: e.division,
        section: e.section,
        coupon_no: e.couponNo,
        ryot_number: e.ryotNo,
        ryot_name: e.name,
        father_name: e.fatherName,
        village: e.village,
        cane_wt: e.caneWt,
        sugar_qty: e.eligibleQty,
        sugar_rate: e.sugarRate,
        amount: e.amount,
        payment_mode: paymentMethod,
        collected_by: sessionData.session.user.email,
      }));

      const { error } = await supabase.from("sales_table").insert(records);
      if (error) throw error;

      toast({ title: "Payment Recorded ✅" });

      setEntries(prev =>
        prev.map(e =>
          e.status === "NEW" ? { ...e, status: "ALREADY COLLECTED" } : e
        )
      );

    } catch (e: any) {
      toast({ title: "Failed", description: formatSupabaseError(e.message), variant: "destructive" });
    } finally {
      setIsConfirming(false);
    }
  };

  /* ===================== TOTALS ===================== */

  const totalSugar = useMemo(
    () => entries.filter(e => e.status === "NEW").reduce((s, e) => s + e.eligibleQty, 0),
    [entries]
  );

  const totalAmount = useMemo(
    () => entries.filter(e => e.status === "NEW").reduce((s, e) => s + e.amount, 0),
    [entries]
  );

  /* ===================== UI ===================== */

  return (
    <BackgroundLayout>
      <div className="min-h-screen p-4 md:p-8">

        {/* Header */}
        <GlassCard className="p-4 mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft />
          </Button>
          <img src={nslLogo} className="h-8" />
          <h1 className="text-xl font-bold">Collect Sugar</h1>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Search */}
          <GlassCard className="p-6">
            <Label>Coupon No / Ryot No</Label>
            <Input
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
            />
            <Button className="w-full mt-4" onClick={handleAdd} disabled={isAdding}>
              <Plus className="mr-2" /> Add Farmer
            </Button>
          </GlassCard>

          {/* Table */}
          <GlassCard className="p-6 lg:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coupon</TableHead>
                  <TableHead>Ryot</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(e => (
                  <TableRow key={e.ryotNo}>
                    <TableCell>{e.couponNo}</TableCell>
                    <TableCell>{e.ryotNo}</TableCell>
                    <TableCell>{e.name}</TableCell>
                    <TableCell>{e.eligibleQty}</TableCell>
                    <TableCell>{e.sugarRate}</TableCell>
                    <TableCell>{e.amount}</TableCell>
                    <TableCell>{e.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassCard>
        </div>

        {/* Payment */}
        {entries.some(e => e.status === "NEW") && (
          <GlassCard className="p-6 mt-6">
            <p>Total Qty: {totalSugar}</p>
            <p>Total Amount: ₹{totalAmount}</p>

            <RadioGroup value={paymentMethod} onValueChange={v => setPaymentMethod(v as any)}>
              <RadioGroupItem value="cash" /> Cash
              <RadioGroupItem value="qr" /> QR
            </RadioGroup>

            <Button onClick={handleConfirm} className="mt-4">
              <Check className="mr-2" /> Confirm Payment
            </Button>
          </GlassCard>
        )}
      </div>
    </BackgroundLayout>
  );
};

export default CollectSugar;
