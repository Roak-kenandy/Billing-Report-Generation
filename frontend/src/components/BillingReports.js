import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { getApiBaseUrl, getAuthHeaders } from '../utils/auth';

const toDayString = (date) => (date ? format(date, 'yyyy-MM-dd') : '');

const COLUMNS = [
    'Account Number',
    'Contact Code',
    'Device Code',
    'Customer Name',
    'Customer Type',
    'Customer Type 2',
    'Payment Type',
    'Sales Model',
    'Submitted By User',
    'Area',
    'Dealer',
    'Mobile',
    'Ward',
    'Road',
    'Island',
    'Atoll',
    'STB',
    'Status',
    'Package',
    'Price',
    'Start Date',
    'End Date',
];

const BillingReports = () => {
    const [reports, setReports] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [selectedAtoll, setSelectedAtoll] = useState('');
    const [selectedIsland, setSelectedIsland] = useState('');
    const [appliedFilters, setAppliedFilters] = useState(null);
    const [error, setError] = useState('');
    const [atolls, setAtolls] = useState([]);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const isFetchingRef = useRef(false);
    const API_URL = getApiBaseUrl();

    useEffect(() => {
        const fetchAtolls = async () => {
            try {
                const response = await fetch(`${API_URL}/getAtolls`, { headers: getAuthHeaders() });
                const data = await response.json();
                setAtolls(data.data || []);
            } catch (err) {
                console.error('Error fetching atolls:', err);
            }
        };
        fetchAtolls();
    }, [API_URL]);

    const buildQuery = useCallback((filters, page, limit) => {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));
        params.append('startDate', filters.startDate);
        params.append('endDate', filters.endDate);
        if (filters.search) params.append('search', filters.search);
        const atollData = atolls.find((a) => a.atolls_id === filters.atoll);
        if (atollData) params.append('atoll', atollData.atolls_name);
        const islandName = atollData?.islands.find((i) => i.islands_id === filters.island)?.islands_name;
        if (islandName) params.append('island', islandName);
        return params;
    }, [atolls]);

    const fetchReports = useCallback(async (filters, page, limit) => {
        if (!filters || isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoading(true);
        setError('');
        try {
            const params = buildQuery(filters, page, limit);
            const response = await fetch(`${API_URL}/getReports?${params.toString()}`, {
                headers: getAuthHeaders(),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to fetch subscription reports');
            setReports(data.data || []);
            setPagination({
                page: data.pagination?.page || page,
                limit: data.pagination?.limit || limit,
                total: data.pagination?.total || 0,
                totalPages: data.pagination?.totalPages || 0,
            });
        } catch (err) {
            console.error('Error fetching reports:', err);
            setReports([]);
            setError(err.message);
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [API_URL, buildQuery]);

    useEffect(() => {
        if (!appliedFilters) return;
        fetchReports(appliedFilters, pagination.page, pagination.limit);
    }, [appliedFilters, pagination.page, pagination.limit, fetchReports]);

    const handleFilter = () => {
        if (!startDate || !endDate) {
            setError('Please select both Start Date and End Date.');
            return;
        }
        if (startDate > endDate) {
            setError('Start Date must be on or before End Date.');
            return;
        }
        setError('');
        setAppliedFilters({
            startDate: toDayString(startDate),
            endDate: toDayString(endDate),
            search: searchTerm.trim(),
            atoll: selectedAtoll,
            island: selectedIsland,
        });
        setPagination((prev) => ({ ...prev, page: 1 }));
    };

    const handleClearFilter = () => {
        setStartDate(null);
        setEndDate(null);
        setSelectedAtoll('');
        setSelectedIsland('');
        setSearchTerm('');
        setAppliedFilters(null);
        setReports([]);
        setError('');
        setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
    };

    const handlePageChange = (event, value) => {
        setPagination((prev) => ({ ...prev, page: value }));
    };

    const handleDownloadCSV = async () => {
        if (!appliedFilters) {
            setError('Apply a date filter before downloading.');
            return;
        }
        try {
            setIsDownloading(true);
            const params = buildQuery(appliedFilters, 1, 10);
            params.delete('page');
            params.delete('limit');
            const response = await fetch(`${API_URL}/getAllReports?${params.toString()}`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Export failed');
            }
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute(
                'download',
                `subscription-reports-${appliedFilters.startDate}-to-${appliedFilters.endDate}.csv`
            );
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Export error:', error);
            setError(error.message);
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
            <Box sx={{ mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
                    Subscription Reports
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    All packages that started in the selected date range (every status except DRAFT).
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Box
                    sx={{
                        display: 'flex',
                        gap: 2,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        mb: 2,
                        p: 2,
                        backgroundColor: '#ffffff',
                        borderRadius: 2,
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
                        '& > *': { minWidth: isSmallScreen ? '100%' : 'auto' },
                    }}
                >
                    <DatePicker
                        label="Start Date *"
                        value={startDate}
                        onChange={setStartDate}
                        slotProps={{
                            textField: {
                                size: 'small',
                                required: true,
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
                        label="End Date *"
                        value={endDate}
                        onChange={setEndDate}
                        slotProps={{
                            textField: {
                                size: 'small',
                                required: true,
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
                        placeholder="Account, code, phone, name, package"
                        size="small"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleFilter(); }}
                        sx={{
                            width: isSmallScreen ? '100%' : 240,
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                backgroundColor: '#f1f5f9',
                            },
                        }}
                    />
                    <FormControl size="small" sx={{ width: isSmallScreen ? '100%' : 180 }}>
                        <InputLabel>Atoll</InputLabel>
                        <Select
                            value={selectedAtoll}
                            label="Atoll"
                            onChange={(e) => {
                                setSelectedAtoll(e.target.value);
                                setSelectedIsland('');
                            }}
                            sx={{ borderRadius: 2, backgroundColor: '#f1f5f9' }}
                        >
                            <MenuItem value="">All Atolls</MenuItem>
                            {atolls.map((atoll) => (
                                <MenuItem key={atoll.atolls_id} value={atoll.atolls_id}>
                                    {atoll.atolls_name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ width: isSmallScreen ? '100%' : 180 }} disabled={!selectedAtoll}>
                        <InputLabel>Island</InputLabel>
                        <Select
                            value={selectedIsland}
                            label="Island"
                            onChange={(e) => setSelectedIsland(e.target.value)}
                            sx={{ borderRadius: 2, backgroundColor: '#f1f5f9' }}
                        >
                            <MenuItem value="">All Islands</MenuItem>
                            {atolls
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
                        sx={{ height: 40, borderRadius: 2, backgroundColor: '#3b82f6', textTransform: 'none' }}
                    >
                        Filter
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={handleClearFilter}
                        startIcon={<ClearIcon />}
                        sx={{ height: 40, borderRadius: 2, textTransform: 'none' }}
                    >
                        Clear
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={!isSmallScreen && <GetApp />}
                        onClick={handleDownloadCSV}
                        disabled={isDownloading || !appliedFilters}
                        sx={{ height: 40, borderRadius: 2, backgroundColor: '#22c55e', textTransform: 'none' }}
                    >
                        {isDownloading ? 'Exporting...' : isSmallScreen ? <GetApp /> : 'Download'}
                    </Button>
                </Box>
            </LocalizationProvider>

            {appliedFilters && !loading && (
                <Typography variant="body2" sx={{ mb: 1, color: '#64748b' }}>
                    {pagination.total} packages started from {appliedFilters.startDate} to {appliedFilters.endDate}
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
                    }}
                >
                    <Table stickyHeader sx={{ minWidth: 1800 }}>
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
                            {!appliedFilters ? (
                                <TableRow>
                                    <TableCell colSpan={COLUMNS.length} sx={{ py: 6, color: '#64748b' }}>
                                        Select Start Date and End Date, then click Filter to load all subscriptions that started in that range.
                                    </TableCell>
                                </TableRow>
                            ) : loading ? (
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
                                    <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4 }}>
                                        No subscriptions found for the selected filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reports.map((report, index) => (
                                    <TableRow
                                        key={`${report['Account Number']}-${report.Package}-${report['Start Date']}-${index}`}
                                        hover
                                        sx={{
                                            '&:last-child td': { borderBottom: 0 },
                                            '&:hover': { backgroundColor: '#f1f5f9' },
                                        }}
                                    >
                                        {COLUMNS.map((key) => (
                                            <TableCell
                                                key={key}
                                                title={report[key] != null ? String(report[key]) : ''}
                                                sx={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    maxWidth: 200,
                                                    py: 2,
                                                    px: 2,
                                                    color:
                                                        report[key] === 'NOT_EFFECTIVE'
                                                            ? '#ef4444'
                                                            : report[key] === 'EFFECTIVE'
                                                                ? '#22c55e'
                                                                : '#475569',
                                                    fontWeight:
                                                        ['Contact Code', 'Device Code', 'Customer Name', 'Account Number'].includes(key)
                                                            ? 500
                                                            : 400,
                                                }}
                                            >
                                                {report[key] ?? ''}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            {appliedFilters && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, pb: 2 }}>
                    {loading ? (
                        <Skeleton variant="rectangular" width={200} height={40} sx={{ borderRadius: 2 }} />
                    ) : (
                        <Pagination
                            count={pagination.totalPages || 1}
                            page={pagination.page}
                            onChange={handlePageChange}
                            color="primary"
                            showFirstButton
                            showLastButton
                        />
                    )}
                </Box>
            )}
        </Box>
    );
};

export default BillingReports;
