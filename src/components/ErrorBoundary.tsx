import { Component, ReactNode } from 'react';
import { BackgroundLayout } from '@/components/BackgroundLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <BackgroundLayout>
          <div className="min-h-screen flex items-center justify-center p-4">
            <GlassCard className="p-8 max-w-md w-full">
              <div className="flex flex-col items-center text-center">
                <div className="p-4 rounded-full bg-destructive/20 mb-4">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Application Error</h1>
                <p className="text-muted-foreground mb-4">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
                {this.state.error?.message?.includes('Supabase') && (
                  <div className="bg-muted p-4 rounded-lg mb-4 text-left w-full">
                    <p className="text-sm font-medium mb-2">Possible solutions:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Check that .env.local exists in the project root</li>
                      <li>Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set</li>
                      <li>Restart the development server after creating .env.local</li>
                      <li>Check the browser console for more details</li>
                    </ul>
                  </div>
                )}
                <Button onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
              </div>
            </GlassCard>
          </div>
        </BackgroundLayout>
      );
    }

    return this.props.children;
  }
}

