import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import BillingReports from "./components/BillingReports";
import LoginReports from "./components/loginReport/loginReport";
import ProtectedRoute from './components/loginReport/ProtectedRoute'; 
import ResetPassword from "./components/loginReport/ResetPassword";
import ReusableLhs from "./components/loginReport/reusableLhs";
import Dashboard from "./components/loginReport/dashboard";
import DealerReport from "./components/loginReport/DealerReport";
import CollectionReport from "./components/loginReport/Collection";
import ServiceRequestReport from "./components/loginReport/ServiceRequestReport";
import ManualJournalReport from "./components/loginReport/ManualJournalReport";
import RbacRoles from "./components/loginReport/RbacRoles";
import RbacPermissions from "./components/loginReport/RbacPermissions";

function App() {
  return (
    <Router basename="/reports">
      <div className="App">
        <Routes>
          <Route path="/login" element={<LoginReports />} />
          <Route path="/reset-password/:resetToken" element={<ResetPassword />} /> 

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
        <Route path="/" element={<ReusableLhs />}>
        <Route path="subscription" element={<BillingReports />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="dealer" element={<DealerReport />} />
        <Route path="collection" element={<CollectionReport />} />
        <Route path="serviceRequest" element={<ServiceRequestReport />} />
        <Route path="manualJournal" element={<ManualJournalReport />} />
        <Route path="rbac/roles" element={<RbacRoles />} />
        <Route path="rbac/permissions" element={<RbacPermissions />} />
        </Route>
        </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
