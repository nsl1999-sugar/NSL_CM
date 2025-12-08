import { ReactNode } from "react";
import nslLogo from "@/assets/nsl-sugars-logo.png";

interface BackgroundLayoutProps {
  children: ReactNode;
}

const BackgroundLayout = ({ children }: BackgroundLayoutProps) => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background with logo pattern */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          background: `linear-gradient(135deg, hsl(0 72% 51% / 0.05) 0%, hsl(0 0% 95%) 50%, hsl(0 72% 51% / 0.08) 100%)`,
        }}
      />
      
      {/* Logo pattern overlay */}
      <div 
        className="fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `url(${nslLogo})`,
          backgroundSize: '200px',
          backgroundPosition: 'center',
          backgroundRepeat: 'repeat',
        }}
      />
      
      {/* Large centered logo (blurred) */}
      <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none">
        <img 
          src={nslLogo} 
          alt="NSL Sugars" 
          className="w-[500px] h-auto opacity-10 blur-sm"
        />
      </div>
      
      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {children}
      </div>
    </div>
  );
};

export { BackgroundLayout };
