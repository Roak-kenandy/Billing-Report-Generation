import React, { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    TextField,
    Button,
    Pagination,
    IconButton,
    Tooltip,
    Box,
    Skeleton,
} from '@mui/material';
import { Search, Visibility, GetApp } from '@mui/icons-material';

const BillingReports = () => {
    const [reports, setReports] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    // const [csvData, setCsvData] = useState([]);

    // Fetch reports from the backend
    const fetchReports = async (page, limit, search = '') => {
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:3000/billing-reports/getReports?page=${page}&limit=${limit}&search=${search}`);
            const data = await response.json();
            console.log(data.data,'data comes along data')
            setReports(data.data);
            setPagination(data.pagination);
        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    };

        // Fetch all reports for CSV download
        const fetchAllReports = async (search = '') => {
            setLoading(true);
            try {
                const response = await fetch(`http://localhost:3000/billing-reports/getAllReports?search=${search}`);
                const data = await response.json();
                return data;
            } catch (err) {
                console.error('Error fetching all reports:', err);
            } finally {
                setLoading(false);
            }
        };

    // Fetch reports on component mount and when pagination/search changes
    useEffect(() => {
        fetchReports(pagination.page, pagination.limit, searchTerm);
    }, [pagination.page, pagination.limit, searchTerm]);

    // Handle page change
    const handlePageChange = (event, value) => {
        setPagination({ ...pagination, page: value });
    };

    // Handle search
    const handleSearch = (event) => {
        setSearchTerm(event.target.value);
        setPagination({ ...pagination, page: 1 }); // Reset to first page on search
    };

    // Prepare data for CSV download
// Prepare data for CSV download with formatted date
// const csvData = reports.map(report => ({
//     ID: report.id,
//     Name: report.Name,
//     'Active Packages': report['Active Packages'].length,
//     'First Activation Date': report['Active Packages'].map(pkg =>
//       new Date(pkg.first_activation_date * 1000).toLocaleDateString('en-GB', {
//         year: 'numeric',
//         month: '2-digit',
//         day: '2-digit',
//       })
//     ).join(', '),
//     'Package Names': report['Active Packages'].map(pkg => pkg.product?.name).join(', '),  // Joining package names
//     'Package States': report['Active Packages'].map(pkg => pkg.state).join(', ') 
//   }));

  
    // Handle CSV download
    // const handleDownloadCSV = async () => {
    //     const allReports = await fetchAllReports(searchTerm);
    //     const formattedData = allReports.map(report => ({
    //         ID: report.id,
    //         Name: report.Name,
    //         'Active Packages': report['Active Packages'].length,
    //         'First Activation Date': report['Active Packages'].map(pkg =>
    //           new Date(pkg.first_activation_date * 1000).toLocaleDateString('en-GB', {
    //             year: 'numeric',
    //             month: '2-digit',
    //             day: '2-digit',
    //           })
    //         ).join(', '),
    //         'Package Names': report['Active Packages'].map(pkg => pkg.product?.name).join(', '),
    //         'Package States': report['Active Packages'].map(pkg => pkg.state).join(', ')
    //     }));
    //     setCsvData(formattedData);
    // };

    // const handleDownloadCSV = async () => {
    //     try {
    //         const response = await fetch(`http://localhost:3000/billing-reports/getAllReports?search=${searchTerm}`);
    //         if (!response.ok) throw new Error('Failed to download CSV');
    
    //         // Create a Blob from the streamed data
    //         const blob = await response.blob();
    
    //         // Create a download link and trigger the download
    //         const url = window.URL.createObjectURL(blob);
    //         const a = document.createElement('a');
    //         a.href = url;
    //         a.download = 'billing_reports.csv';
    //         a.click();
    //         window.URL.revokeObjectURL(url);
    //     } catch (err) {
    //         console.error('Error downloading CSV:', err);
    //     }
    // };

    const handleDownloadCSV = async () => {
        try {
            setIsDownloading(true);
            const url = new URL('http://localhost:3000/billing-reports/getAllReports', window.location.origin);
            url.searchParams.append('search', searchTerm);

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
            setIsDownloading(false);
        }
    };
  
  

    return (
        <Box sx={{ padding: 3, backgroundColor: '#f5f5f5' }}>

<Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
    {loading ? (
        <Skeleton variant="rectangular" width={150} height={40} animation="wave" />
    ) : (
        <Button
            variant="contained"
            startIcon={<GetApp />}
            onClick={handleDownloadCSV} // Trigger the streaming download
            disabled={isDownloading}
            sx={{
                backgroundColor: '#007bff',
                '&:hover': { backgroundColor: '#0056b3' },
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 'bold',
            }}
        >
            {isDownloading ? 'Exporting...' : 'Download CSV'}
        </Button>
    )}
            </Box>

            {/* Search Bar */}
            <TextField
                label="Search by Name or ID"
                variant="outlined"
                value={searchTerm}
                onChange={handleSearch}
                fullWidth
                margin="normal"
                InputProps={{
                    startAdornment: <Search sx={{ color: '#666' }} />,
                }}
                sx={{
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                            borderColor: '#ddd',
                        },
                        '&:hover fieldset': {
                            borderColor: '#007bff',
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: '#007bff',
                        },
                    },
                }}
            />

            {/* Table */}
            <Box sx={{ height: '44vh', overflow: 'scroll' }}>
                <TableContainer component={Paper} sx={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
                    <Table sx={{ minWidth: 650 }}>
                        <TableHead sx={{ backgroundColor: '#007bff' }}>
                            <TableRow>
                                <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>ID</TableCell>
                                <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Name</TableCell>
                                <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Active Packages</TableCell>
                                <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Expiry Date</TableCell>
                                <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Package Names</TableCell>
                                <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Package States</TableCell>
                                <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading
                                ? // Show skeleton loading while data is being fetched
                                  Array.from({ length: 5 }).map((_, index) => (
                                      <TableRow key={index}>
                                          <TableCell>
                                              <Skeleton variant="text" animation="wave" />
                                          </TableCell>
                                          <TableCell>
                                              <Skeleton variant="text" animation="wave" />
                                          </TableCell>
                                          <TableCell>
                                              <Skeleton variant="text" animation="wave" />
                                          </TableCell>
                                          <TableCell>
                                              <Skeleton variant="circular" width={40} height={40} animation="wave" />
                                          </TableCell>
                                      </TableRow>
                                  ))
                                : // Show actual data once loaded
                                  reports.map((report) => (
                                      <TableRow
                                          key={report.id}
                                          sx={{
                                              '&:hover': { backgroundColor: '#f1f1f1' },
                                              transition: 'background-color 0.3s ease',
                                          }}
                                      >
                                          <TableCell sx={{ color: '#555' }}>{report.id}</TableCell>
                                          <TableCell sx={{ color: '#555' }}>{report.Name}</TableCell>
                                          <TableCell sx={{ color: '#555' }}>{report['Active Packages']}</TableCell>
                                          <TableCell sx={{ color: '#555' }}>{report['Expiry Date']}</TableCell>
                                          <TableCell sx={{ color: '#555' }}>{report['Package Names']}</TableCell>
                                          <TableCell sx={{ color: '#555' }}>{report['Package States']}</TableCell>
                                          {/* Display Active Packages */}
                                            {/* <TableCell sx={{ color: '#555' }}>
                                                {report['Active Packages'].length > 0 ? (
                                                    <ul style={{paddingInlineStart: '13px'}}>
                                                        {report['Active Packages'].map((pkg, index) => (
                                                            <li key={index}>
                                                                <strong>First Activation Date:</strong> {new Date(pkg.first_activation_date * 1000).toLocaleDateString()}, 
                                                                <strong>Name:</strong> {pkg.product?.name}, 
                                                                <strong>State:</strong> {pkg.state}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span>No active packages</span>
                                                )}
                                            </TableCell> */}
                                          <TableCell>
                                              <Tooltip title="View Details">
                                                  <IconButton
                                                      onClick={() => alert(`Viewing details for ${report.id}`)}
                                                      sx={{ color: '#007bff', '&:hover': { color: '#0056b3' } }}
                                                  >
                                                      <Visibility />
                                                  </IconButton>
                                              </Tooltip>
                                          </TableCell>
                                      </TableRow>
                                  ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            {/* Pagination */}
            <Box sx={{ display: 'flex', justifyContent: 'center', marginTop: 3 }}>
                {loading ? (
                    <Skeleton variant="rectangular" width={200} height={40} animation="wave" />
                ) : (
                    <Pagination
                        count={pagination.totalPages}
                        page={pagination.page}
                        onChange={handlePageChange}
                        color="primary"
                        sx={{
                            '& .MuiPaginationItem-root': {
                                color: '#007bff',
                                '&.Mui-selected': {
                                    backgroundColor: '#007bff',
                                    color: '#fff',
                                },
                            },
                        }}
                    />
                )}
            </Box>

            {/* Download CSV Button */}
            {/* <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3 }}>
                {loading ? (
                    <Skeleton variant="rectangular" width={150} height={40} animation="wave" />
                ) : (
                    <CSVLink data={csvData} filename="billing_reports.csv" style={{ textDecoration: 'none' }}>
                        <Button
                            variant="contained"
                            startIcon={<GetApp />}
                            sx={{
                                backgroundColor: '#007bff',
                                '&:hover': { backgroundColor: '#0056b3' },
                                borderRadius: '8px',
                                textTransform: 'none',
                                fontWeight: 'bold',
                            }}
                        >
                            Download CSV
                        </Button>
                    </CSVLink>
                )}
            </Box> */}


            {/* Download CSV Button */}
            {/* <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3 }}>
                {loading ? (
                    <Skeleton variant="rectangular" width={150} height={40} animation="wave" />
                ) : (
                    <CSVLink data={csvData} filename="billing_reports.csv" asyncOnClick onClick={handleDownloadCSV} style={{ textDecoration: 'none' }}>
                        <Button
                            variant="contained"
                            startIcon={<GetApp />}
                            sx={{
                                backgroundColor: '#007bff',
                                '&:hover': { backgroundColor: '#0056b3' },
                                borderRadius: '8px',
                                textTransform: 'none',
                                fontWeight: 'bold',
                            }}
                        >
                            Download CSV
                        </Button>
                    </CSVLink>
                )}
            </Box> */}
        
        </Box>
    );
};

export default BillingReports;


