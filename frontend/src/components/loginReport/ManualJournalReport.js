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
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/auth';

const tableHeaders = [
    'Account Number',
    'Contact Name',
    'Action Type',
    'Amount',
    'Posted Date',
    'Remarks',
    'Submitted By',
];

const ManualJournalReport = () => {
    const [reports, setReports] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const API_URL = getApiBaseUrl();

    const formatDateParam = (date) => (date ? date.toISOString().split('T')[0] : '');

    const fetchReports = async (page, limit, start = '', end = '') => {
        setLoading(true);
        try {
            let url = `${API_URL}/getManualJournalReports?page=${page}&limit=${limit}`;
            if (start) url += `&startDate=${encodeURIComponent(start)}`;
            if (end) url += `&endDate=${encodeURIComponent(end)}`;

            const response = await fetch(url, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch reports');

            const data = await response.json();
            setReports(data.data || []);
            setPagination(data.pagination || { page, limit, total: 0, totalPages: 0 });
        } catch (err) {
            console.error('Error fetching reports:', err);
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!appliedStartDate || !appliedEndDate) {
            setReports([]);
            setLoading(false);
            return;
        }
        fetchReports(pagination.page, pagination.limit, appliedStartDate, appliedEndDate);
    }, [pagination.page, pagination.limit, appliedStartDate, appliedEndDate]);

    const handleFilter = () => {
        if (!startDate || !endDate) {
            alert('Select both a start date and an end date.');
            return;
        }
        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            alert('Start date cannot be after end date');
            return;
        }
        setAppliedStartDate(formatDateParam(startDate));
        setAppliedEndDate(formatDateParam(endDate));
        setPagination((prev) => ({ ...prev, page: 1 }));
    };

    const handleClearFilter = () => {
        setStartDate(null);
        setEndDate(null);
        setAppliedStartDate('');
        setAppliedEndDate('');
        setPagination((prev) => ({ ...prev, page: 1 }));
    };

    const handlePageChange = (event, value) => {
        setPagination({ ...pagination, page: value });
    };

    const handleDownloadCSV = async () => {
        try {
            setIsDownloading(true);
            let url = `${API_URL}/getManualJournalReports?export=csv`;
            if (appliedStartDate) url += `&startDate=${encodeURIComponent(appliedStartDate)}`;
            if (appliedEndDate) url += `&endDate=${encodeURIComponent(appliedEndDate)}`;

            const response = await fetch(url, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Export failed');

            const csvBlob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(csvBlob);

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', 'manual_journal_reports.csv');
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
                        onChange={(newValue) => setStartDate(newValue)}
                        slotProps={{
                            textField: {
                                InputLabelProps: { shrink: true },
                                sx: {
                                    width: isSmallScreen ? '100%' : 180,
                                    '& .MuiOutlinedInput-root': { borderRadius: 2, backgroundColor: '#f1f5f9' },
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
                                    width: isSmallScreen ? '100%' : 180,
                                    '& .MuiOutlinedInput-root': { borderRadius: 2, backgroundColor: '#f1f5f9' },
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
                                {tableHeaders.map((header) => (
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
                                        {Array.from({ length: tableHeaders.length }).map((_, cellIndex) => (
                                            <TableCell key={cellIndex} sx={{ py: 2 }}>
                                                <Skeleton variant="text" animation="wave" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : reports.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={tableHeaders.length} sx={{ textAlign: 'center', py: 4, color: '#64748b' }}>
                                        No data available
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reports.map((report, index) => (
                                    <TableRow
                                        key={report.id || index}
                                        hover
                                        sx={{
                                            '&:last-child td': { borderBottom: 0 },
                                            transition: 'background-color 0.2s ease',
                                            '&:hover': { backgroundColor: '#f1f5f9' },
                                        }}
                                    >
                                        {tableHeaders.map((key) => (
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

export default ManualJournalReport;
