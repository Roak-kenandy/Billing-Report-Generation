import React, { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    Pagination,
    Box,
    Skeleton,
    useMediaQuery,
} from '@mui/material';
import { GetApp } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const DealerReport = () => {
    const [reports, setReports] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const API_URL = 'http://localhost:3003/billing-reports';


    // Fetch reports from the backend
    const fetchReports = async (page, limit) => {
        setLoading(true);
        try {
            let url = `${API_URL}/getDealerReports?page=${page}&limit=${limit}}`;

            const response = await fetch(url);
            const data = await response.json();
            console.log(data, 'data comes along');
            setReports(data.data);
            setPagination(data.pagination);
        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    // Fetch reports on component mount and when pagination/search changes
    useEffect(() => {
        fetchReports(pagination.page, pagination.limit);
    }, [pagination.page, pagination.limit]);

    // Handle page change
    const handlePageChange = (event, value) => {
        setPagination({ ...pagination, page: value });
    };

    const handleDownloadCSV = async () => {
        try {
            setIsDownloading(true)
            let url = new URL(`${API_URL}/getAllDealerReports`);

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
        <Box sx={{
            padding: 3,
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 37px)',
            overflow: 'hidden'
        }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Box sx={{
                    display: 'flex',
                    gap: 2,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    mb: 2,
                    '& > *': { minWidth: isSmallScreen ? '100%' : 'auto' }
                }}>

                    <Button
                        variant="contained"
                        startIcon={!isSmallScreen && <GetApp />}
                        onClick={handleDownloadCSV}
                        disabled={isDownloading}
                        sx={{
                            width: isSmallScreen ? '100%' : 'auto',
                            height: 56
                        }}
                    >
                        {isDownloading ? 'Exporting...' : (isSmallScreen ? <GetApp /> : 'Download')}
                    </Button>
                </Box>
            </LocalizationProvider>

            {/* Table Container */}
            <Box sx={{
                flex: 1,
                overflow: 'hidden',
                position: 'relative',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
                <TableContainer
                    component={Paper}
                    sx={{
                        height: '100%',
                        overflow: 'auto',
                        '&::-webkit-scrollbar': {
                            height: 8,
                            width: 8,
                        },
                        '&::-webkit-scrollbar-thumb': {
                            backgroundColor: '#bdbdbd',
                            borderRadius: 4,
                        },
                    }}
                >
                    <Table stickyHeader sx={{ minWidth: 1600 }}> {/* Increased min-width for better column spacing */}
                        <TableHead>
                            <TableRow>
                                {[
                                    'Date', 'Dealer Name', 'Account Type', 'Amount', 'BP Commission', 'GST', 'Original Payment', 'Total TopUp Amount'
                                ].map((header) => (
                                    <TableCell
                                        key={header}
                                        sx={{
                                            fontWeight: 'bold',
                                            backgroundColor: '#007bff',
                                            color: 'white',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {header}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 10 }).map((_, index) => (
                                    <TableRow key={index}>
                                        {Array.from({ length: 20 }).map((_, cellIndex) => (
                                            <TableCell key={cellIndex}>
                                                <Skeleton variant="text" animation="wave" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (reports.map((report) => (
                                <TableRow key={report.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                                    {[
                                        'Date', 'Dealer Name', 'Account Type', 'Amount', 'BP Commission', 'GST', 'Original Payment', 'Total TopUp Amount'
                                    ].map((key) => (
                                        <TableCell
                                            key={key}
                                            sx={{
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                maxWidth: 200,
                                                color: report[key] === 'NOT_EFFECTIVE' ? 'red' :
                                                    report[key] === 'EFFECTIVE' ? '#11c785' :
                                                        ['Contact Code', 'Device Code', 'Customer Name'].includes(key) ? 'inherit' : '#555'
                                            }}
                                        >
                                            {report[key]}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            )))
                            }
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            {/* Pagination */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                borderTop: '1px solid #eee',
                marginTop: '10px'
            }}>
                {loading ? (
                    <Skeleton variant="rectangular" width={200} height={40} />
                ) : (
                    <Pagination
                        count={pagination.totalPages}
                        page={pagination.page}
                        onChange={handlePageChange}
                        color="primary"
                        showFirstButton
                        showLastButton
                        sx={{
                            '& .MuiPaginationItem-root': {
                                fontSize: '0.875rem'
                            }
                        }}
                    />
                )}
            </Box>
        </Box>
    );
};

export default DealerReport;