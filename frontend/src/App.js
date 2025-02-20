import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import BillingReports from "./components/BillingReports";
import {Typography} from '@mui/material';

function App() {
  return (
    <Router>
      <div className="App">
            <Typography variant="h4" gutterBottom>
                Medianet Billing Reports
            </Typography>
        <Routes>
          <Route path="/billing-reports" element={<BillingReports />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
