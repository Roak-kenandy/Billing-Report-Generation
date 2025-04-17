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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import { GetApp } from '@mui/icons-material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

const MtvRegisteredCustomer = () => {
    const [reports, setReports] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    // const API_URL = 'http://localhost:3003/billing-reports';
    const API_URL = 'https://mdnrpt.medianet.mv/billing-reports';

    const fetchReports = async (page, limit, search = '', start = '', end = '') => {
        setLoading(true);
        try {
            let url = `${API_URL}/mtv/registered?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
            if (start) url += `&startDate=${encodeURIComponent(start)}`;
            if (end) url += `&endDate=${encodeURIComponent(end)}`;

            const response = await fetch(url);
            const data = await response.json();
            setReports(data.data);
            setPagination(data.pagination);
        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = () => {
        setAppliedStartDate(startDate);
        setAppliedEndDate(endDate);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleClearFilter = () => {
        setStartDate('');
        setEndDate('');
        setAppliedStartDate('');
        setAppliedEndDate('');
        setSearchTerm('');
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    useEffect(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
    }, [searchTerm, appliedStartDate, appliedEndDate]);

    useEffect(() => {
        fetchReports(pagination.page, pagination.limit, searchTerm, appliedStartDate, appliedEndDate);
    }, [pagination.page, pagination.limit, searchTerm, appliedStartDate, appliedEndDate]);

    const handlePageChange = (event, value) => {
        setPagination({ ...pagination, page: value });
    };

    const handleDownloadCSV = async () => {
        try {
            setIsDownloading(true);
            let url = new URL(`${API_URL}/mtv/registered`, window.location.origin);
            url.searchParams.append('search', searchTerm);
            if (startDate) url.searchParams.append('startDate', startDate);
            if (endDate) url.searchParams.append('endDate', endDate);
    
            const response = await fetch(url);
            if (!response.ok) throw new Error('Export failed');
    
            const data = await response.json();
    
            const headers = ['Date', 'Name', 'Phone Number', 'Referral Code', 'Referral Type'];
            const csvRows = [
                headers.join(','),
                ...data.data.map(row =>
                    [
                        row['Date'],
                        `"${row['Name']}"`,
                        row['Phone Number'],
                        row['Referral Code'],
                        row['Referral Type'],
                    ].join(',')
                ),
            ];
            const csvContent = csvRows.join('\n');
    
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const downloadUrl = window.URL.createObjectURL(blob);
    
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', 'registered-customers.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Box
            sx={{
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 37px)',
                overflow: 'hidden',
                background: '#f9fafb',
            }}
        >
            <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: isSmallScreen ? 'column' : 'row', // Stack vertically on small screens
                        gap: 1.5, // Reduced gap for a tighter layout
                        alignItems: isSmallScreen ? 'stretch' : 'center', // Stretch on small screens, center on large
                        justifyContent: 'space-between', // Spread elements evenly on larger screens
                        mb: 2,
                        p: 1.5, // Reduced padding to make it less bulky
                        backgroundColor: '#ffffff',
                        borderRadius: 2,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', // Softer shadow
                        '& > *': { 
                            flex: isSmallScreen ? '1 1 100%' : '0 1 auto', // Full width on small screens
                            minWidth: 0, // Prevent overflow
                        },
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            gap: 1.5,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            flex: 1,
                        }}
                    >
                        <DatePicker
                            label="Start Date"
                            value={startDate}
                            onChange={(newValue) => setStartDate(newValue)}
                            slotProps={{
                                textField: {
                                    InputLabelProps: { shrink: true },
                                    sx: {
                                        width: isSmallScreen ? '100%' : 150, // Smaller width on larger screens
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            backgroundColor: '#f1f5f9',
                                            height: 40, // Smaller input height
                                        },
                                        '& .MuiInputLabel-root': {
                                            fontSize: '0.9rem', // Smaller label font
                                        },
                                    },
                                },
                            }}
                        />

                        <DatePicker
                            label="End Date"
                            value={endDate}
                            onChange={(newValue) => setEndDate(newValue)}
                            slotProps={{
                                textField: {
                                    InputLabelProps: { shrink: true },
                                    sx: {
                                        width: isSmallScreen ? '100%' : 150,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            backgroundColor: '#f1f5f9',
                                            height: 40,
                                        },
                                        '& .MuiInputLabel-root': {
                                            fontSize: '0.9rem',
                                        },
                                    },
                                },
                            }}
                        />
                    </Box>

                    <Box
                        sx={{
                            display: 'flex',
                            gap: 1,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: isSmallScreen ? 'stretch' : 'flex-end',
                        }}
                    >
                        <Button
                            variant="contained"
                            onClick={handleFilter}
                            startIcon={<FilterAltIcon />}
                            sx={{
                                width: isSmallScreen ? '100%' : 'auto',
                                height: 40, // Smaller button height
                                borderRadius: 2,
                                backgroundColor: '#3b82f6',
                                textTransform: 'none',
                                fontSize: '0.9rem', // Smaller font
                                fontWeight: 500,
                                padding: '8px 16px', // Adjusted padding
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    backgroundColor: '#2563eb',
                                    transform: 'translateY(-1px)',
                                },
                            }}
                        >
                            Filter
                        </Button>

                        <Button
                            variant="outlined"
                            onClick={handleClearFilter}
                            startIcon={<ClearIcon />}
                            sx={{
                                width: isSmallScreen ? '100%' : 'auto',
                                height: 40,
                                borderRadius: 2,
                                borderColor: '#e2e8f0',
                                color: '#64748b',
                                textTransform: 'none',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                padding: '8px 16px',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    borderColor: '#3b82f6',
                                    color: '#3b82f6',
                                    transform: 'translateY(-1px)',
                                },
                            }}
                        >
                            Clear Filters
                        </Button>

                        <Button
                            variant="contained"
                            startIcon={!isSmallScreen && <GetApp />}
                            onClick={handleDownloadCSV}
                            disabled={isDownloading}
                            sx={{
                                width: isSmallScreen ? '100%' : 'auto',
                                height: 40,
                                borderRadius: 2,
                                backgroundColor: '#22c55e',
                                textTransform: 'none',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                padding: '8px 16px',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    backgroundColor: '#16a34a',
                                    transform: 'translateY(-1px)',
                                },
                            }}
                        >
                            {isDownloading ? 'Exporting...' : isSmallScreen ? <GetApp /> : 'Download'}
                        </Button>
                    </Box>
                </Box>
            </LocalizationProvider>

            <Box
                sx={{
                    flex: 1,
                    overflow: 'hidden',
                    borderRadius: 2,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                    backgroundColor: '#ffffff',
                }}
            >
                <TableContainer
                    component={Paper}
                    sx={{
                        height: '100%',
                        overflow: 'auto',
                        borderRadius: 2,
                        '&::-webkit-scrollbar': {
                            height: 6,
                            width: 6,
                        },
                        '&::-webkit-scrollbar-thumb': {
                            backgroundColor: '#94a3b8',
                            borderRadius: 3,
                        },
                    }}
                >
                    <Table stickyHeader sx={{ minWidth: 800 }}>
                        <TableHead>
                            <TableRow>
                                {[
                                    'Name', 'Phone Number', 'Date', 'Referral Code', 'Referral Type'
                                ].map((header) => (
                                    <TableCell
                                        key={header}
                                        sx={{
                                            fontWeight: 600,
                                            background: 'linear-gradient(90deg, #1e3a8a, #1e40af)',
                                            color: '#ffffff',
                                            whiteSpace: 'nowrap',
                                            py: 1,
                                            px: 1,
                                            borderBottom: 'none',
                                            width: header === 'Name' ? 150 : 100,
                                            fontSize: '0.75rem',
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
                                        {Array.from({ length: 5 }).map((_, cellIndex) => (
                                            <TableCell key={cellIndex} sx={{ py: 1, px: 1 }}>
                                                <Skeleton variant="text" animation="wave" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                reports.map((report) => (
                                    <TableRow
                                        key={report.id}
                                        hover
                                        sx={{
                                            '&:last-child td': { borderBottom: 0 },
                                            transition: 'background-color 0.2s ease',
                                            '&:hover': { backgroundColor: '#f1f5f9' },
                                        }}
                                    >
                                        {[
                                            'Name', 'Phone Number', 'Date', 'Referral Code', 'Referral Type'
                                        ].map((key) => (
                                            <TableCell
                                                key={key}
                                                sx={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    maxWidth: key === 'Name' ? 150 : 100,
                                                    py: 1,
                                                    px: 1,
                                                    color:
                                                        report[key] === 'NOT_EFFECTIVE'
                                                            ? '#ef4444'
                                                            : report[key] === 'EFFECTIVE'
                                                            ? '#22c55e'
                                                            : '#475569',
                                                    fontWeight:
                                                        ['Contact Code', 'Device Code', 'Customer Name'].includes(key)
                                                            ? 500
                                                            : 400,
                                                    fontSize: '0.75rem',
                                                }}
                                            >
                                                {report[key]}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mt: 3,
                    pb: 2,
                }}
            >
                {loading ? (
                    <Skeleton variant="rectangular" width={200} height={40} sx={{ borderRadius: 2 }} />
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
                                fontSize: '0.875rem',
                                borderRadius: 1,
                                transition: 'all 0.3s ease',
                                '&:hover': { backgroundColor: '#e2e8f0' },
                            },
                            '& .Mui-selected': {
                                backgroundColor: '#3b82f6 !important',
                                color: '#ffffff',
                            },
                        }}
                    />
                )}
            </Box>
        </Box>
    );
};

export default MtvRegisteredCustomer;