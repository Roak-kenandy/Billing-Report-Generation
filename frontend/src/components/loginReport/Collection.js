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
    Alert,
    Typography,
} from '@mui/material';
import { GetApp } from '@mui/icons-material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import ClearIcon from '@mui/icons-material/Clear';
import { format } from 'date-fns';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/auth';

const COLUMNS = [
    'Customer Name',
    'Account',
    'Area',
    'Dealer',
    'Ward',
    'Road',
    'Island',
    'Atoll',
    'Payment Method',
    'Posted Date',
    'Total Amount',
    'Amount',
    'GST',
    'Reference Number',
    'User Name',
];

const EMPTY_PAGINATION = { page: 1, limit: 20, total: 0, totalPages: 0 };

const Collection = () => {
    const [reports, setReports] = useState([]);
    const [pagination, setPagination] = useState(EMPTY_PAGINATION);
    const [loading, setLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [appliedFilters, setAppliedFilters] = useState(null);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const [atolls, setAtolls] = useState([]);
    const [selectedAtoll, setSelectedAtoll] = useState('');
    const [selectedIsland, setSelectedIsland] = useState('');
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

    const buildParams = (filters, page, limit, csv) => {
        const params = new URLSearchParams();
        params.set('startDate', filters.startDate);
        params.set('endDate', filters.endDate);
        params.set('page', String(page));
        params.set('limit', String(limit));
        if (csv) params.set('format', 'csv');
        if (filters.atoll) params.set('atoll', filters.atoll);
        if (filters.island) params.set('island', filters.island);
        return params;
    };

    const fetchReports = async (filters, page, limit) => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(
                `${API_URL}/getCollectionReports?${buildParams(filters, page, limit).toString()}`,
                { headers: getAuthHeaders() }
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to load collection reports');
            setReports(Array.isArray(data.data) ? data.data : []);
            setPagination({
                page: data.pagination?.page || page,
                limit: data.pagination?.limit || limit,
                total: data.pagination?.total || 0,
                totalPages: data.pagination?.totalPages || 0,
            });
        } catch (err) {
            setReports([]);
            setPagination((prev) => ({ ...(prev || EMPTY_PAGINATION), total: 0, totalPages: 0 }));
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!appliedFilters) return;
        fetchReports(appliedFilters, pagination.page, pagination.limit);
        // pagination.page is the only page trigger; limit stays on the filter object
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appliedFilters, pagination.page]);

    const handleFilter = () => {
        if (!startDate || !endDate) {
            setError('Select a start date and an end date before loading collection reports.');
            return;
        }
        const atollName = atolls.find((item) => item.atolls_id === selectedAtoll)?.atolls_name || '';
        const islandName = atolls
            .find((item) => item.atolls_id === selectedAtoll)
            ?.islands?.find((item) => item.islands_id === selectedIsland)?.islands_name || '';
        setPagination((prev) => ({ ...(prev || EMPTY_PAGINATION), page: 1 }));
        setAppliedFilters({
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(endDate, 'yyyy-MM-dd'),
            atoll: atollName,
            island: islandName,
        });
    };

    const handleClearFilter = () => {
        setStartDate(null);
        setEndDate(null);
        setSelectedAtoll('');
        setSelectedIsland('');
        setAppliedFilters(null);
        setReports([]);
        setError('');
        setPagination(EMPTY_PAGINATION);
    };

    const handleDownloadCSV = async () => {
        if (!appliedFilters) {
            setError('Apply a date filter before downloading.');
            return;
        }
        try {
            setIsDownloading(true);
            const response = await fetch(
                `${API_URL}/getCollectionReports?${buildParams(appliedFilters, 1, pagination.limit, true).toString()}`,
                { headers: getAuthHeaders() }
            );
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Export failed');
            }
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', 'collection-reports.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Collection Reports</Typography>
                <Button
                    variant="contained"
                    startIcon={<GetApp />}
                    onClick={handleDownloadCSV}
                    disabled={isDownloading || !appliedFilters}
                >
                    {isDownloading ? 'Downloading...' : 'Download CSV'}
                </Button>
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
                Select a start and end date, then click Filter. The report loads payments posted in that range only.
            </Alert>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
                    }}
                >
                    <DatePicker
                        label="Start Date *"
                        value={startDate}
                        onChange={setStartDate}
                        slotProps={{ textField: { size: 'small', sx: { width: isSmallScreen ? '100%' : 180 } } }}
                    />
                    <DatePicker
                        label="End Date *"
                        value={endDate}
                        onChange={setEndDate}
                        slotProps={{ textField: { size: 'small', sx: { width: isSmallScreen ? '100%' : 180 } } }}
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
                        >
                            <MenuItem value="">All</MenuItem>
                            {atolls.map((atoll) => (
                                <MenuItem key={atoll.atolls_id} value={atoll.atolls_id}>{atoll.atolls_name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ width: isSmallScreen ? '100%' : 180 }}>
                        <InputLabel>Island</InputLabel>
                        <Select
                            value={selectedIsland}
                            label="Island"
                            onChange={(e) => setSelectedIsland(e.target.value)}
                            disabled={!selectedAtoll}
                        >
                            <MenuItem value="">All</MenuItem>
                            {(atolls.find((item) => item.atolls_id === selectedAtoll)?.islands || []).map((island) => (
                                <MenuItem key={island.islands_id} value={island.islands_id}>{island.islands_name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button variant="contained" onClick={handleFilter} startIcon={<FilterAltIcon />}>Filter</Button>
                    <Button variant="outlined" onClick={handleClearFilter} startIcon={<ClearIcon />}>Clear</Button>
                </Box>
            </LocalizationProvider>

            <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
                <Table stickyHeader size="small" sx={{ minWidth: 1600 }}>
                    <TableHead>
                        <TableRow>
                            {COLUMNS.map((column) => (
                                <TableCell
                                    key={column}
                                    sx={{
                                        fontWeight: 600,
                                        background: 'linear-gradient(90deg, #1e3a8a, #1e40af)',
                                        color: '#ffffff',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {column}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {!appliedFilters ? (
                            <TableRow>
                                <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4, color: '#64748b' }}>
                                    Choose dates and click Filter to load data.
                                </TableCell>
                            </TableRow>
                        ) : loading ? (
                            [...Array(8)].map((_, index) => (
                                <TableRow key={index}>
                                    {COLUMNS.map((column) => (
                                        <TableCell key={column}><Skeleton variant="text" /></TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : reports.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4, color: '#64748b' }}>
                                    No collections found for the selected dates.
                                </TableCell>
                            </TableRow>
                        ) : (
                            reports.map((row, index) => (
                                <TableRow key={`${row.Account || 'row'}-${row['Reference Number'] || index}`} hover>
                                    {COLUMNS.map((column) => (
                                        <TableCell key={column} sx={{ whiteSpace: 'nowrap' }}>
                                            {row[column] ?? ''}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 2 }}>
                <Pagination
                    count={Math.max(1, pagination.totalPages || 0)}
                    page={pagination.page || 1}
                    onChange={(_, value) => setPagination((prev) => ({ ...(prev || EMPTY_PAGINATION), page: value }))}
                    color="primary"
                    showFirstButton
                    showLastButton
                />
            </Box>
        </Box>
    );
};

export default Collection;
