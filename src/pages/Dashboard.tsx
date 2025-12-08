import { useNavigate } from "react-router-dom";
import { BackgroundLayout } from "@/components/BackgroundLayout";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Tractor, BarChart3, Upload, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import nslLogo from "@/assets/nsl-sugars-logo.png";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const menuItems = [
    {
      icon: Tractor,
      label: "Collect Sugar",
      description: "Process sugar collection from Ryots",
      path: "/collect-sugar",
      gradient: "from-primary/20 to-primary/5",
    },
    {
      icon: BarChart3,
      label: "Sales Report",
      description: "View and download sales reports",
      path: "/sales-report",
      gradient: "from-chart-2/20 to-chart-2/5",
    },
    {
      icon: Upload,
      label: "Upload Excel",
      description: "Upload season data from Excel",
      path: "/upload-excel",
      gradient: "from-chart-4/20 to-chart-4/5",
    },
  ];

const handleLogout = async () => {
  try {
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      await supabase.auth.signOut();
    }
  } catch (error) {
    console.warn("Logout warning:", error);
  } finally {

    localStorage.clear();
    sessionStorage.clear();

    toast({
      title: "Logged out",
      description: "Session ended successfully",
    });

    window.location.href = "/";
  }
};


  return (
    <BackgroundLayout>
      <div className="min-h-screen p-4 md:p-8">
        {/* Header */}
        <GlassCard className="p-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={nslLogo} alt="NSL Sugars" className="h-10" />
              <div>
                <h1 className="text-xl font-bold text-foreground">NSL Sugars</h1>
                <p className="text-sm text-muted-foreground">Coupon Management System</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </GlassCard>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard</h2>
            <p className="text-muted-foreground">Select an option to continue</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {menuItems.map((item) => (
              <GlassCard
                key={item.path}
                className="group cursor-pointer hover:scale-105 transition-transform duration-300 overflow-hidden"
                onClick={() => navigate(item.path)}
              >
                <div className={`p-8 bg-gradient-to-br ${item.gradient}`}>
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 rounded-2xl bg-card/80 shadow-lg mb-4 group-hover:shadow-xl transition-shadow">
                      <item.icon className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {item.label}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default Dashboard;
