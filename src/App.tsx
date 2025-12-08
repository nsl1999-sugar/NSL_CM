import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CollectSugar from "./pages/CollectSugar";
import SalesReport from "./pages/SalesReport";
import UploadExcel from "./pages/UploadExcel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/collect-sugar" 
            element={
              <ProtectedRoute>
                <CollectSugar />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/sales-report" 
            element={
              <ProtectedRoute>
                <SalesReport />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/upload-excel" 
            element={
              <ProtectedRoute>
                <UploadExcel />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
