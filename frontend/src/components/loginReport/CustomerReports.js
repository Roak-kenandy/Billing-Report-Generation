import React, { useState, useEffect, useRef } from 'react';
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
    TextField,
    Alert,
    Typography,
} from '@mui/material';
import { GetApp } from '@mui/icons-material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/auth';

const toDayString = (date) => (date ? format(date, 'yyyy-MM-dd') : '');

const COLUMNS = [
    'Name',
    'Customer Code',
    'Phone',
    'Registered Date',
    'Account Number',
    'Address Line 1',
    'Address Line 2',
    'Address Name',
    'City',
    'Country',
    'Province',
    'Atoll',
    'Island',
    'Service Provider',
    'Device Code',
    'Tags',
    'Device Name',
    'Subscriptions',
    'Active Subscription Amount',
    'Payment Count',
    'Total Paid',
    'Last Payment Date',
    'Last Payment Amount',
    'Payments',
];

const formatCell = (value) => (Array.isArray(value) ? value.join(', ') : value ?? '');

const CustomerReports = () => {
    const [reports, setReports] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const [atolls, setAtolls] = useState([]);
    const [selectedAtoll, setSelectedAtoll] = useState('');
    const [selectedIsland, setSelectedIsland] = useState('');
    const [appliedFilters, setAppliedFilters] = useState(null);
    const [error, setError] = useState('');
    const requestIdRef = useRef(0);
    const API_URL = getApiBaseUrl();

    useEffect(() => {
        const fetchAtolls = async () => {
            try {
                const response = await fetch(`${API_URL}/getAtolls`, { headers: getAuthHeaders() });
                const data = await response.json();
                setAtolls(data.data);
            } catch (err) {
                console.error('Error fetching atolls:', err);
            }
        };
        fetchAtolls();
    }, []);

    const buildQuery = (filters) => {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        params.append('startDate', toDayString(filters.startDate));
        params.append('endDate', toDayString(filters.endDate));
        const atollData = atolls.find(a => a.atolls_id === filters.atoll);
        if (atollData) params.append('atoll', atollData.atolls_name);
        const islandName = atollData?.islands.find(i => i.islands_id === filters.island)?.islands_name;
        if (islandName) params.append('island', islandName);
        return params;
    };

    const fetchReports = async (page, filters) => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError('');
        try {
            const params = buildQuery(filters);
            params.append('page', page);
            params.append('limit', pagination.limit);
            params.append('format', 'json');
            const response = await fetch(`${API_URL}/customerReports?${params.toString()}`, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch reports');
            const data = await response.json();
            if (requestId !== requestIdRef.current) return;
            setReports(data.data || []);
            setPagination(data.pagination);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error('Error fetching reports:', err);
            setReports([]);
            setError('Failed to load customer reports. Please try again.');
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    };

    const handleFilter = () => {
        if (!startDate || !endDate) {
            setError('Please select both Start Date and End Date.');
            return;
        }
        if (startDate > endDate) {
            setError('Start Date must be on or before End Date.');
            return;
        }
        const filters = {
            search: searchTerm.trim(),
            startDate,
            endDate,
            atoll: selectedAtoll,
            island: selectedIsland,
        };
        setAppliedFilters(filters);
        fetchReports(1, filters);
    };

    const handleClearFilter = () => {
        requestIdRef.current++;
        setStartDate(null);
        setEndDate(null);
        setSelectedAtoll('');
        setSelectedIsland('');
        setSearchTerm('');
        setAppliedFilters(null);
        setReports([]);
        setError('');
        setLoading(false);
        setPagination(prev => ({ ...prev, page: 1, total: 0, totalPages: 0 }));
    };

    const handlePageChange = (event, value) => {
        if (appliedFilters) fetchReports(value, appliedFilters);
    };

    const handleDownloadCSV = async () => {
        if (!appliedFilters) {
            setError('Apply a date filter before downloading.');
            return;
        }
        try {
            setIsDownloading(true);
            const params = buildQuery(appliedFilters);
            params.append('format', 'csv');
            const url = `${API_URL}/customerReports?${params.toString()}`;

            const response = await fetch(url, { headers: getAuthHeaders() });
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
                    <TextField
                        label="Search"
                        placeholder="Account no, code, phone, name"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleFilter(); }}
                        InputLabelProps={{ shrink: true }}
                        sx={{
                            width: isSmallScreen ? '100%' : 220,
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                backgroundColor: '#f1f5f9',
                            },
                        }}
                    />
                    <FormControl sx={{ width: isSmallScreen ? '100%' : 180 }}>
                        <InputLabel id="atoll-select-label">Atoll</InputLabel>
                        <Select
                            labelId="atoll-select-label"
                            value={selectedAtoll}
                            label="Atoll"
                            onChange={(e) => {
                                setSelectedAtoll(e.target.value);
                                setSelectedIsland('');
                            }}
                            sx={{
                                borderRadius: 2,
                                backgroundColor: '#f1f5f9',
                            }}
                        >
                            <MenuItem value="">All Atolls</MenuItem>
                            {atolls.map((atoll) => (
                                <MenuItem key={atoll.atolls_id} value={atoll.atolls_id}>
                                    {atoll.atolls_name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl sx={{ width: isSmallScreen ? '100%' : 180 }} disabled={!selectedAtoll}>
                        <InputLabel id="island-select-label">Island</InputLabel>
                        <Select
                            labelId="island-select-label"
                            value={selectedIsland}
                            label="Island"
                            onChange={(e) => setSelectedIsland(e.target.value)}
                            sx={{
                                borderRadius: 2,
                                backgroundColor: '#f1f5f9',
                            }}
                        >
                            <MenuItem value="">All Islands</MenuItem>
                            {selectedAtoll &&
                                atolls
                                    .find((a) => a.atolls_id === selectedAtoll)
                                    ?.islands.map((island) => (
                                        <MenuItem key={island.islands_id} value={island.islands_id}>
                                            {island.islands_name}
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
                        disabled={isDownloading || !appliedFilters}
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
            {error && (
                <Alert severity="warning" onClose={() => setError('')} sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            {appliedFilters && !loading && (
                <Typography variant="body2" sx={{ mb: 1, color: '#64748b' }}>
                    {pagination.total} customers registered from {toDayString(appliedFilters.startDate)} to {toDayString(appliedFilters.endDate)}
                </Typography>
            )}
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
                                {COLUMNS.map((header) => (
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
                                        {COLUMNS.map((column) => (
                                            <TableCell key={column} sx={{ py: 2 }}>
                                                <Skeleton variant="text" animation="wave" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : reports.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={COLUMNS.length} sx={{ py: 6, textAlign: 'left', color: '#64748b' }}>
                                        {appliedFilters
                                            ? 'No customers found for the selected filters.'
                                            : 'Select Start Date and End Date, then click Filter to load customers.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
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
                                        {COLUMNS.map((key) => (
                                            <TableCell
                                                key={key}
                                                title={String(formatCell(report[key]))}
                                                sx={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    maxWidth: key === 'Subscriptions' || key === 'Payments' ? 360 : 200,
                                                    py: 2,
                                                    px: 2,
                                                    color: '#475569',
                                                    fontWeight: key === 'Name' ? 500 : 400,
                                                }}
                                            >
                                                {formatCell(report[key])}
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
                ) : pagination.total > 0 && (
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

export default CustomerReports;