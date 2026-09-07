import { useNavigate, useLocation } from "react-router";
import { Button } from "@/app/components/ui/button";
import { LayoutDashboard, FileText, TrendingUp, DollarSign, Users, Settings, LogOut, Shield, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/web/dashboard" },
    { icon: FileText, label: "Claims", path: "/web/claims" },
    { icon: TrendingUp, label: "Fraud Analytics", path: "/web/fraud-analytics" },
    { icon: DollarSign, label: "Settlements", path: "/web/settlements" },
    { icon: Users, label: "Team", path: "/web/team" },
    { icon: Settings, label: "Settings", path: "/web/settings" },
  ];

  // Handle swipe gesture
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipe();
    };

    const handleSwipe = () => {
      const swipeDistanceX = touchEndX - touchStartX;
      const swipeDistanceY = Math.abs(touchEndY - touchStartY);
      
      // Swipe right to open (from left edge)
      if (touchStartX < 50 && swipeDistanceX > 100 && swipeDistanceY < 100) {
        setIsMobileOpen(true);
      }
      
      // Swipe left to close (when sidebar is open and swipe is within sidebar)
      if (isMobileOpen && touchStartX < 256 && swipeDistanceX < -100 && swipeDistanceY < 100) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobileOpen]);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed top-4 left-4 z-50 bg-white shadow-md"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-64 bg-gray-900 text-white flex flex-col h-screen
        md:relative fixed top-0 left-0 z-50
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">AIVALA</h1>
              <p className="text-xs text-gray-400">Insurer Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                variant="ghost"
                className={`w-full justify-start ${isActive ? 'bg-blue-600 hover:bg-blue-700' : 'hover:bg-gray-800'}`}
                onClick={() => navigate(item.path)}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.label}
              </Button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <Button variant="ghost" className="w-full justify-start text-red-400 hover:bg-gray-800" onClick={() => navigate("/web/login")}>
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </Button>
        </div>
      </div>
    </>
  );
}