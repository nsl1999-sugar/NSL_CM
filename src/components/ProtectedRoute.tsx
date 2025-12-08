import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { BackgroundLayout } from '@/components/BackgroundLayout';
import { GlassCard } from '@/components/GlassCard';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/');
        return;
      }
      
      setAuthenticated(true);
      setLoading(false);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/');
      } else {
        setAuthenticated(true);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <BackgroundLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <GlassCard className="p-8">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </GlassCard>
        </div>
      </BackgroundLayout>
    );
  }

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
};

