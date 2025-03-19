import { Button } from '@mui/material';

const API_URL = 'http://localhost:3003/billing-reports';

const handleDownloadCSV = async (team, queue) => {
    try {
        const url = new URL(`${API_URL}/getServicerequestReports`);

        url.searchParams.append('team', team);
        url.searchParams.append('queue', queue);

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('Export failed');

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', 'service-request-reports.csv');
        document.body.appendChild(link);
        link.click();

        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        console.error('Export error:', error);
    }
};

const ServiceRequestReport = () => {
    return (
        <div>
            <h1>Service Request Report</h1>

            <Button
                onClick={() =>
                    handleDownloadCSV(
                        'b0cc03f3-be1a-4087-8ef4-b404c404c934',
                        'd584630a-995f-4785-a31b-617bd65e8cd7'
                    )
                }
                variant="contained"
            >
                Service Request Aging Report
            </Button>
        </div>
    );
};

export default ServiceRequestReport;
