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
import BulkUploads from "./components/loginReport/BulkUploads";
import BulkDealerUploads from "./components/loginReport/BulkDealerUploads";
import MtvRegisteredCustomer from './components/loginReport/MtvRegisteredCustomer';
import ReferralCountReports from './components/loginReport/ReferralCountReports';
import DeviceStatistics from './components/loginReport/DeviceStatistics';
import SubscribedDealerReports from './components/loginReport/SubscribedDealerReports';
import SubscribedDisconnectedReports from './components/loginReport/SubscribedDisconnectedReport';
import DealerWisecollection from './components/loginReport/DealerWiseCollection';
import InvoiceReports from './components/loginReport/InvoiceReports';
import HdcReports from './components/loginReport/HdcReports';
import BulkService from './components/loginReport/BulkService';
import HDCCustomerReports from './components/loginReport/hdcCustomerReports';
import HdcCustomerInvocieReports from './components/loginReport/hdcCustomerInvoiceReports';
import HdcConsolidatedReports from './components/loginReport/hdcConsolidatedReports';
// import DeviceNames from './components/loginReport/DeviceNames';
// import DynamicReportBuilder from './components/loginReport/DynamicReportBuilder';
import CustomerReports from './components/loginReport/CustomerReports';
import { ToastContainer, Flip } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// import RbacPermissions from "./components/loginReport/RbacPermissions";

function App() {
  return (
    <Router basename="/reports">
      <div className="App">
      <ToastContainer
          position="bottom-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          transition={Flip}
        />
        <Routes>
          <Route path="/login" element={<LoginReports />} />
          <Route path="/reset-password/:resetToken" element={<ResetPassword />} /> 

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
        <Route path="/" element={<ReusableLhs />}>
        <Route path="subscription" element={<BillingReports />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="dealer" element={<DealerReport />} />
        <Route path="bulkUploads" element={<BulkUploads />} />
        <Route path="bulkDealerUploads" element={<BulkDealerUploads />} />
        <Route path="collection" element={<CollectionReport />} />
        <Route path="serviceRequest" element={<ServiceRequestReport />} />
        <Route path="manualJournal" element={<ManualJournalReport />} />
        <Route path="mtv/registered" element={<MtvRegisteredCustomer />} />
        <Route path="rbac/roles" element={<RbacRoles />} />
        <Route path="mtv/registered/counts" element={<ReferralCountReports />} />
        <Route path="device/statistics" element={<DeviceStatistics />} />
        <Route path="subscribed/dealers" element={<SubscribedDealerReports />} />
        <Route path="subscribed/disconnected" element={<SubscribedDisconnectedReports />} />
        <Route path="dealerWiseCollection" element={<DealerWisecollection />} />
        {/* <Route path="deviceNames" element={<DeviceNames />} /> */}
        {/* <Route path="dynamicReportBuilder" element={<DynamicReportBuilder />} /> */}
        <Route path="customerReports" element={<CustomerReports />} />
        <Route path="invoiceReports" element={<InvoiceReports />} />
        <Route path="hdcReports" element={<HdcReports/>} />
        <Route path="bulkService" element={<BulkService/>} />
        <Route path="hdcCustomer" element={<HDCCustomerReports/>} />
        <Route path="hdcCustomerInvoiceReports" element={<HdcCustomerInvocieReports/>} />
        <Route path="hdcConsolidatedReports" element={<HdcConsolidatedReports/>} />
        {/* <Route path="rbac/permissions" element={<RbacPermissions />} /> */}
        </Route>
        </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
