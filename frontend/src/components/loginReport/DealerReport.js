import { useState } from "react";
import { Button } from '@mui/material';

const DealerReport = () => {
    const [dealerReports, setDealerReports] = useState('');

    const handleDownloadCSV = async () => {
        try {
            let url = new URL('http://localhost:3000/billing-reports/getAllDealerReports');

            const response = await fetch(url);
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', 'reports.csv');
            document.body.appendChild(link);
            link.click();

            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Export error:', error);
            // Show error notification
        } finally {
            // setIsDownloading(false);
        }
    };
    return (
        <>
        <div>Dealer Reports</div>
        <Button onClick={handleDownloadCSV}>Download Dealer Reports</Button>
        </>
    )
}

export default DealerReport;