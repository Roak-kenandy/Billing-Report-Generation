import { useState, useEffect, useCallback, useRef } from 'react';
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
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';

const HDCCustomerReports = () => {
    const [reports, setReports] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const limit = 10;
    const isMountedRef = useRef(true);

    const API_URL = 'https://mdnrpt.medianet.mv/billing-reports';
    // const API_URL = 'http://localhost:3003/billing-reports';

    const fetchReports = useCallback(async (page, start = '', end = '') => {
        setLoading(true);
        try {
            let url = `${API_URL}/hdcCustomerReports?page=${page}&limit=${limit}&format=json`;
            if (start) url += `&startDate=${encodeURIComponent(start)}`;
            if (end) url += `&endDate=${encodeURIComponent(end)}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch reports');
            const data = await response.json();
            
            if (!isMountedRef.current) return;
            
            setReports(data.data || []);
            setPagination({
                page,
                total: data.pagination?.total || 0,
                totalPages: data.pagination?.totalPages || 0,
            });
        } catch (err) {
            if (!isMountedRef.current) return;
            console.error('Error fetching reports:', err);
            setReports([]);
            setPagination({ page: 1, total: 0, totalPages: 0 });
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [API_URL, limit]);

    useEffect(() => {
        isMountedRef.current = true;
        fetchReports(pagination.page, appliedStartDate, appliedEndDate);
        
        return () => {
            isMountedRef.current = false;
        };
    }, [fetchReports, pagination.page, appliedStartDate, appliedEndDate]);

    const handleFilter = () => {
        setAppliedStartDate(startDate ? format(startDate, 'yyyy-MM-dd') : '');
        setAppliedEndDate(endDate ? format(endDate, 'yyyy-MM-dd') : '');
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleClearFilter = () => {
        setStartDate(null);
        setEndDate(null);
        setAppliedStartDate('');
        setAppliedEndDate('');
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handlePageChange = (_, value) => {
        setPagination(prev => ({ ...prev, page: value }));
    };

    const handleDownloadCSV = async () => {
        try {
            setIsDownloading(true);
            let url = new URL(`${API_URL}/hdcCustomerReports`, window.location.origin);
            url.searchParams.append('format', 'csv');
            if (appliedStartDate) url.searchParams.append('startDate', appliedStartDate);
            if (appliedEndDate) url.searchParams.append('endDate', appliedEndDate);

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error('Export failed');
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', 'customer-reports.csv');
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
                        gap: 2,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        mb: 3,
                        p: 2,
                        backgroundColor: '#ffffff',
                        borderRadius: 2,
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
                        '& > *': { minWidth: isSmallScreen ? '100%' : 'auto' },
                    }}
                >
                    <DatePicker
                        label="Start Date"
                        value={startDate}
                        onChange={setStartDate}
                        slotProps={{
                            textField: {
                                InputLabelProps: { shrink: true },
                                sx: {
                                    width: isSmallScreen ? '100%' : 180,
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        backgroundColor: '#f1f5f9',
                                    },
                                },
                            },
                        }}
                    />
                    <DatePicker
                        label="End Date"
                        value={endDate}
                        onChange={setEndDate}
                        slotProps={{
                            textField: {
                                InputLabelProps: { shrink: true },
                                sx: {
                                    width: isSmallScreen ? '100%' : 180,
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        backgroundColor: '#f1f5f9',
                                    },
                                },
                            },
                        }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleFilter}
                        startIcon={<FilterAltIcon />}
                        sx={{
                            width: isSmallScreen ? '100%' : 'auto',
                            height: 48,
                            borderRadius: 2,
                            backgroundColor: '#3b82f6',
                            textTransform: 'none',
                            fontWeight: 500,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                backgroundColor: '#2563eb',
                                transform: 'translateY(-2px)',
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
                            height: 48,
                            borderRadius: 2,
                            borderColor: '#e2e8f0',
                            color: '#64748b',
                            textTransform: 'none',
                            fontWeight: 500,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                borderColor: '#3b82f6',
                                color: '#3b82f6',
                                transform: 'translateY(-2px)',
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
                            height: 48,
                            borderRadius: 2,
                            backgroundColor: '#22c55e',
                            textTransform: 'none',
                            fontWeight: 500,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                backgroundColor: '#16a34a',
                                transform: 'translateY(-2px)',
                            },
                        }}
                    >
                        {isDownloading ? 'Exporting...' : isSmallScreen ? <GetApp /> : 'Download'}
                    </Button>
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
                    <Table stickyHeader sx={{ minWidth: 1200 }}>
                        <TableHead>
                            <TableRow>
                                {[
                                    'Name',
                                    'Contact Code',
                                    'Address Name',
                                    'Address Line 1',
                                    'Address Line 2',
                                    'City',
                                    'Province',
                                    'Phone',
                                    'Sales Model',
                                    'Registered Date',
                                ].map((header) => (
                                    <TableCell
                                        key={header}
                                        sx={{
                                            fontWeight: 600,
                                            background: 'linear-gradient(90deg, #1e3a8a, #1e40af)',
                                            color: '#ffffff',
                                            whiteSpace: 'nowrap',
                                            py: 1.5,
                                            px: 2,
                                            borderBottom: 'none',
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
                                        {Array.from({ length: 10 }).map((_, cellIndex) => (
                                            <TableCell key={cellIndex} sx={{ py: 2 }}>
                                                <Skeleton variant="text" animation="wave" height={24} />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : reports.length > 0 ? (
                                reports.map((report, index) => (
                                    <TableRow
                                        key={index}
                                        hover
                                        sx={{
                                            '&:last-child td': { borderBottom: 0 },
                                            transition: 'background-color 0.2s ease',
                                            '&:hover': { backgroundColor: '#f1f5f9' },
                                        }}
                                    >
                                        {[
                                            'Name',
                                            'Contact Code',
                                            'Address Name',
                                            'Address Line 1',
                                            'Address Line 2',
                                            'City',
                                            'Province',
                                            'Phone',
                                            'Sales Model',
                                            'Registered Date',
                                        ].map((key) => (
                                            <TableCell
                                                key={key}
                                                sx={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    maxWidth: 200,
                                                    py: 2,
                                                    px: 2,
                                                    color: '#475569',
                                                    fontWeight: key === 'Name' ? 500 : 400,
                                                }}
                                            >
                                                {report[key] || ''}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                                        No reports found
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
            {!loading && pagination.totalPages > 0 && (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        mt: 3,
                        pb: 2,
                    }}
                >
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
                </Box>
            )}
        </Box>
    );
};

export default HDCCustomerReports;