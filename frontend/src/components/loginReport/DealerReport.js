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
    InputLabel,
    FormControl,
    Select,
    MenuItem,
    Tooltip
} from '@mui/material';
import { GetApp } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';

const DealerReport = () => {
    const [reports, setReports] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [dealers, setDealers] = useState([]);
    const [selectedDealer, setSelectedDealer] = useState('');
    const [appliedDealer, setAppliedDealer] = useState('');
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    const API_URL = 'http://localhost:3003/billing-reports';
    // const API_URL = 'https://mdnrpt.medianet.mv/billing-reports';

    useEffect(() => {
        const fetchDealers = async () => {
            try {
                const response = await fetch(`${API_URL}/getDealerNames`);
                const data = await response.json();
                setDealers(data.data.data);
            } catch (err) {
                console.error('Error fetching dealers:', err);
            }
        };
        fetchDealers();
    }, []);

    const fetchReports = async (page, limit, start = '', end = '') => {
        setLoading(true);
        try {
            let url = `${API_URL}/getDealerReports?page=${page}&limit=${limit}`;
            if (start) url += `&startDate=${encodeURIComponent(start)}`;
            if (end) url += `&endDate=${encodeURIComponent(end)}`;
            if (appliedDealer) {
                const selectedDealerName = dealers.find((dealer) => dealer.dealerName === appliedDealer);
                if (selectedDealerName) url += `&dealerName=${selectedDealerName.dealerName}`;
            }
            const response = await fetch(url);
            const data = await response.json();
            console.log(data, 'data comes along');
            console.log(appliedDealer, 'selectedDealerselectedDealer');
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

    useEffect(() => {
        fetchReports(pagination.page, pagination.limit, appliedStartDate, appliedEndDate);
    }, [pagination.page, pagination.limit, appliedDealer, appliedStartDate, appliedEndDate]);

    const handlePageChange = (event, value) => {
        setPagination({ ...pagination, page: value });
    };

    const handleFilter = () => {
        setAppliedStartDate(startDate);
        setAppliedEndDate(endDate);
        setAppliedDealer(selectedDealer);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleClearFilter = () => {
        setStartDate('');
        setEndDate('');
        setAppliedStartDate('');
        setAppliedEndDate('');
        setSelectedDealer('');
        setAppliedDealer('');
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleDownloadCSV = async () => {
        try {
            setIsDownloading(true);
            let url = new URL(`${API_URL}/getAllDealerReports`);
            if (appliedStartDate) url.searchParams.append('startDate', appliedStartDate);
            if (appliedEndDate) url.searchParams.append('endDate', appliedEndDate);
            if (appliedDealer) {
                const selectedDealerName = dealers.find((dealer) => dealer.dealerName === appliedDealer);
                if (selectedDealerName) url += `&dealerName=${selectedDealerName.dealerName}`;
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', 'dealer_reports.csv');
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
                        onChange={(newValue) => setEndDate(newValue)}
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

                    <FormControl sx={{ width: isSmallScreen ? '100%' : 180 }}>
                        <InputLabel sx={{ color: '#64748b' }}>Dealers</InputLabel>
                        <Select
                            value={selectedDealer}
                            label="Dealer"
                            onChange={(e) => {
                                setSelectedDealer(e.target.value);
                            }}
                            sx={{
                                borderRadius: 2,
                                backgroundColor: '#f1f5f9',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#e2e8f0',
                                },
                            }}
                        >
                            <MenuItem value="">All Dealers</MenuItem>
                            {dealers.map((dealer) => (
                                <MenuItem key={dealer.dealerName} value={dealer.dealerName}>
                                    {dealer.dealerName}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

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
                                    'Date', 'Dealer Name', 'Account Type', 'Amount', 'BP Commission', 'GST', 'Original Payment', 'Total TopUp Amount'
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
                                        {Array.from({ length: 8 }).map((_, cellIndex) => (
                                            <TableCell key={cellIndex} sx={{ py: 2 }}>
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
                                            'Date', 'Dealer Name', 'Account Type', 'Amount', 'BP Commission', 'GST', 'Original Payment', 'Total TopUp Amount'
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
                                                    fontWeight: ['Dealer Name'].includes(key) ? 500 : 400,
                                                }}
                                            >
                                                {key === 'Dealer Name' && report[key] ? (
                                                    <Tooltip title={report[key]} arrow>
                                                        <span>{report[key]}</span>
                                                    </Tooltip>
                                                ) : (
                                                    report[key]
                                                )}
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

export default DealerReport;