import { createHashRouter } from "react-router";
import Root from "@/app/components/Root";
import MobileApp from "@/app/pages/mobile/MobileApp";
import WebDashboard from "@/app/pages/web/WebDashboard";
import NotFound from "@/app/components/NotFound";

// Mobile app routes
import Welcome from "@/app/pages/mobile/Welcome";
import Login from "@/app/pages/mobile/Login";
import Register from "@/app/pages/mobile/Register";
import Dashboard from "@/app/pages/mobile/Dashboard";
import NewClaimType from "@/app/pages/mobile/NewClaimType";
import VideoRecording from "@/app/pages/mobile/VideoRecording";
import ClaimDetails from "@/app/pages/mobile/ClaimDetails";
import ClaimSubmission from "@/app/pages/mobile/ClaimSubmission";
import ProcessingScreen from "@/app/pages/mobile/ProcessingScreen";
import ResultsScreen from "@/app/pages/mobile/ResultsScreen";
import DamageDetails from "@/app/pages/mobile/DamageDetails";
import SettlementScreen from "@/app/pages/mobile/SettlementScreen";
import ClaimsHistory from "@/app/pages/mobile/ClaimsHistory";
import Profile from "@/app/pages/mobile/Profile";
import Settings from "@/app/pages/mobile/Settings";

// Web dashboard routes
import WebLogin from "@/app/pages/web/WebLogin";
import WebMainDashboard from "@/app/pages/web/WebMainDashboard";
import ClaimsManagement from "@/app/pages/web/ClaimsManagement";
import FraudAnalytics from "@/app/pages/web/FraudAnalytics";
import SettlementManagement from "@/app/pages/web/SettlementManagement";
import TeamManagement from "@/app/pages/web/TeamManagement";
import SystemSettings from "@/app/pages/web/SystemSettings";

export const router = createHashRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Welcome },
      
      // Mobile app routes
      {
        path: "app",
        Component: MobileApp,
        children: [
          { path: "login", Component: Login },
          { path: "register", Component: Register },
          { path: "dashboard", Component: Dashboard },
          { path: "new-claim", Component: NewClaimType },
          { path: "video-recording", Component: VideoRecording },
          { path: "claim-details", Component: ClaimDetails },
          { path: "claim-submission", Component: ClaimSubmission },
          { path: "processing/:claimId", Component: ProcessingScreen },
          { path: "results/:claimId", Component: ResultsScreen },
          { path: "damage/:claimId", Component: DamageDetails },
          { path: "settlement/:claimId", Component: SettlementScreen },
          { path: "history", Component: ClaimsHistory },
          { path: "profile", Component: Profile },
          { path: "settings", Component: Settings },
        ],
      },
      
      // Web dashboard routes
      {
        path: "web",
        Component: WebDashboard,
        children: [
          { path: "login", Component: WebLogin },
          { path: "dashboard", Component: WebMainDashboard },
          { path: "claims", Component: ClaimsManagement },
          { path: "fraud-analytics", Component: FraudAnalytics },
          { path: "settlements", Component: SettlementManagement },
          { path: "team", Component: TeamManagement },
          { path: "settings", Component: SystemSettings },
        ],
      },
      
      { path: "*", Component: NotFound },
    ],
  },
]);
