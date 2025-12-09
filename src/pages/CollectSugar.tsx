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

const CollectSugar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchValue, setSearchValue] = useState("");
  const [entries, setEntries] = useState<FarmerEntry[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr">("cash");
  const [isAdding, setIsAdding] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  /* ---------------- ADD FARMER ---------------- */
  const handleAdd = async () => {
    const lookup = searchValue.trim();
    if (!lookup) {
      toast({
        title: "Error",
        description: "Enter Coupon No or Ryot Number",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAdding(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // prevent duplicate
      if (
        entries.some(
          (e) =>
            e.ryotNo === lookup || e.couponNo === lookup
        )
      ) {
        toast({
          title: "Duplicate",
          description: "Farmer already added",
          variant: "destructive",
        });
        return;
      }

      // fetch farmer
      const { data: farmer } = await supabase
        .from("farmers_table")
        .select("*")
        .or(`ryot_number.eq.${lookup},coupon_no.eq.${lookup}`)
        .maybeSingle();

      if (!farmer) {
        toast({
          title: "Not found",
          description: "Invalid Coupon / Ryot Number",
          variant: "destructive",
        });
        return;
      }

      // already collected?
      const { data: sale } = await supabase
        .from("sales_table")
        .select("id")
        .eq("ryot_number", farmer.ryot_number)
        .maybeSingle();

      const eligibleQty = farmer.eligible_qty || 0;
      const sugarRate = farmer.sugar_rate || DEFAULT_RATE;
      const amount = Number((eligibleQty * sugarRate).toFixed(2));

      setEntries((prev) => [
        ...prev,
        {
          couponNo: farmer.coupon_no,
          ryotNo: farmer.ryot_number,
          name: farmer.ryot_name,
          eligibleQty,
          sugarRate,
          amount,
          status: sale ? "ALREADY COLLECTED" : "NEW",
        },
      ]);

      setSearchValue("");

    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  /* ---------------- CONFIRM PAYMENT ---------------- */
  const handleConfirm = async () => {
    const newEntries = entries.filter((e) => e.status === "NEW");
    if (newEntries.length === 0) {
      toast({
        title: "Nothing to save",
        description: "No NEW entries",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsConfirming(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const insertRows = newEntries.map((e) => ({
        coupon_no: e.couponNo,
        ryot_number: e.ryotNo,
        ryot_name: e.name,
        sugar_qty: e.eligibleQty,
        sugar_rate: e.sugarRate,
        amount: e.amount,
        payment_mode: paymentMethod,
        collected_by: session.user.email,
      }));

      const { error } = await supabase
        .from("sales_table")
        .insert(insertRows);

      if (error) throw error;

      setEntries((prev) =>
        prev.map((e) =>
          e.status === "NEW" ? { ...e, status: "ALREADY COLLECTED" } : e
        )
      );

      toast({
        title: "Success",
        description: "Payment recorded",
      });

    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  /* ---------------- TOTALS ---------------- */
  const totalSugar = useMemo(
    () =>
      entries
        .filter((e) => e.status === "NEW")
        .reduce((s, e) => s + e.eligibleQty, 0),
    [entries]
  );

  const totalAmount = useMemo(
    () =>
      entries
        .filter((e) => e.status === "NEW")
        .reduce((s, e) => s + e.amount, 0),
    [entries]
  );

  /* ---------------- UI ---------------- */
  return (
    <BackgroundLayout>
      <div className="min-h-screen p-4 md:p-8">
        <GlassCard className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={nslLogo} className="h-8" />
            <h1 className="text-xl font-bold">Collect Sugar</h1>
          </div>
        </GlassCard>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ADD */}
          <GlassCard className="p-6">
            <Label>Coupon / Ryot No</Label>
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button className="w-full mt-4" onClick={handleAdd} disabled={isAdding}>
              <Plus className="h-4 w-4 mr-2" /> Add Farmer
            </Button>
          </GlassCard>

          {/* TABLE */}
          <GlassCard className="p-6 lg:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coupon</TableHead>
                  <TableHead>Ryot</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.ryotNo}>
                    <TableCell>{e.couponNo}</TableCell>
                    <TableCell>{e.ryotNo}</TableCell>
                    <TableCell>{e.name}</TableCell>
                    <TableCell className="text-right">{e.eligibleQty}</TableCell>
                    <TableCell className="text-right">{e.sugarRate}</TableCell>
                    <TableCell className="text-right">{e.amount}</TableCell>
                    <TableCell>{e.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassCard>
        </div>

        {/* PAYMENT */}
        {entries.some((e) => e.status === "NEW") && (
          <GlassCard className="p-6 mt-6">
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
              <div className="flex gap-6">
                <RadioGroupItem value="cash" /> Cash
                <RadioGroupItem value="qr" /> QR
              </div>
            </RadioGroup>

            <p className="mt-4 font-bold">
              ₹{totalAmount} | {totalSugar} kg
            </p>

            <Button onClick={handleConfirm} disabled={isConfirming}>
              <Check className="h-4 w-4 mr-2" />
              Confirm Payment
            </Button>
          </GlassCard>
        )}
      </div>
    </BackgroundLayout>
  );
};

export default CollectSugar;
