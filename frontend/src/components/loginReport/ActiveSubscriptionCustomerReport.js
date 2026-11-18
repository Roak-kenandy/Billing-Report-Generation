import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
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

const COLUMNS = [
  'Account', 'Name', 'Contact Code', 'NIC', 'Customer Type', 'Customers dealer',
  'Device Count', 'Smartcard ID', 'Settopbox ID', 'Barcode', 'Client ID', 'STB Type',
  'Available credit', 'Contact', 'Area', 'Atoll', 'Island', 'Ward', 'Street',
  'Inst. Address', 'Floor', 'Apartment', 'Packages', 'Package price', 'Price Sum',
  'Subscribed dates', 'Disconnection dates', 'Registered date',
];

const ActiveSubscriptionCustomerReport = () => {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [atolls, setAtolls] = useState([]);
  const [selectedAtoll, setSelectedAtoll] = useState('');
  const [selectedIsland, setSelectedIsland] = useState('');
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

  const buildQuery = useCallback((filters, page, limit, format) => {
    let url = `${API_URL}/sales-reports/active-subscriptions?page=${page}&limit=${limit}&format=${format}`;
    url += `&startDate=${encodeURIComponent(filters.startDate)}`;
    url += `&endDate=${encodeURIComponent(filters.endDate)}`;
    if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
    if (filters.atoll) url += `&atoll=${encodeURIComponent(filters.atoll)}`;
    if (filters.island) url += `&island=${encodeURIComponent(filters.island)}`;
    return url;
  }, [API_URL]);

  const fetchReports = useCallback(async (filters, page, limit) => {
    if (!filters || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(buildQuery(filters, page, limit, 'json'), {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch report');
      setReports(data.data || []);
      setPagination((prev) => ({
        ...prev,
        page,
        limit,
        totalItems: data.pagination?.totalItems || 0,
        totalPages: data.pagination?.totalPages || 0,
      }));
    } catch (err) {
      setReports([]);
      setError(err.message);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [buildQuery]);

  useEffect(() => {
    if (!filtersApplied || !appliedFilters) return;
    fetchReports(appliedFilters, pagination.page, pagination.limit);
  }, [filtersApplied, appliedFilters, pagination.page, pagination.limit, fetchReports]);

  const handleFilter = () => {
    if (!startDate || !endDate) {
      setError('Start date and end date are required.');
      return;
    }
    const atollName = selectedAtoll
      ? atolls.find((item) => item.atolls_id === selectedAtoll)?.atolls_name || ''
      : '';
    const islandName = selectedAtoll && selectedIsland
      ? atolls.find((item) => item.atolls_id === selectedAtoll)
        ?.islands.find((item) => item.islands_id === selectedIsland)?.islands_name || ''
      : '';

    setError('');
    setAppliedFilters({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      search: searchTerm.trim(),
      atoll: atollName,
      island: islandName,
    });
    setFiltersApplied(true);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setSearchTerm('');
    setSelectedAtoll('');
    setSelectedIsland('');
    setAppliedFilters(null);
    setFiltersApplied(false);
    setReports([]);
    setError('');
    setPagination({ page: 1, limit: 10, totalItems: 0, totalPages: 0 });
  };

  const handleDownload = async () => {
    if (!appliedFilters) {
      setError('Select dates and click Filter before downloading.');
      return;
    }
    setIsDownloading(true);
    try {
      const response = await fetch(buildQuery(appliedFilters, 1, 10, 'csv'), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to download CSV');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'active-subscription-customer-report.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 37px)', overflow: 'hidden', background: '#f9fafb' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
          Active Subscription Customer Report
        </Typography>
        <Button variant="contained" startIcon={<GetApp />} disabled={isDownloading || !filtersApplied} onClick={handleDownload} sx={{ backgroundColor: '#1e3a8a' }}>
          {isDownloading ? 'Downloading...' : 'Download CSV'}
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Customers who still have an EFFECTIVE package that overlaps the selected date range. Expired packages are excluded.
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, p: 2, backgroundColor: '#fff', borderRadius: 2 }}>
          <DatePicker label="Start Date *" value={startDate} onChange={setStartDate} slotProps={{ textField: { size: 'small', required: true } }} />
          <DatePicker label="End Date *" value={endDate} onChange={setEndDate} slotProps={{ textField: { size: 'small', required: true } }} />
          <TextField label="Search (optional)" size="small" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Atoll (optional)</InputLabel>
            <Select label="Atoll (optional)" value={selectedAtoll} onChange={(e) => { setSelectedAtoll(e.target.value); setSelectedIsland(''); }}>
              <MenuItem value="">All</MenuItem>
              {atolls.map((atoll) => <MenuItem key={atoll.atolls_id} value={atoll.atolls_id}>{atoll.atolls_name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Island (optional)</InputLabel>
            <Select label="Island (optional)" value={selectedIsland} onChange={(e) => setSelectedIsland(e.target.value)} disabled={!selectedAtoll}>
              <MenuItem value="">All</MenuItem>
              {(atolls.find((item) => item.atolls_id === selectedAtoll)?.islands || []).map((island) => (
                <MenuItem key={island.islands_id} value={island.islands_id}>{island.islands_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<FilterAltIcon />} onClick={handleFilter}>Filter</Button>
          <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClearFilter}>Clear</Button>
        </Box>
      </LocalizationProvider>

      <Box sx={{ flex: 1, overflow: 'hidden', borderRadius: 2, backgroundColor: '#fff' }}>
        <TableContainer component={Paper} sx={{ height: '100%', overflow: 'auto' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 2400 }}>
            <TableHead>
              <TableRow>
                {COLUMNS.map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 600, background: 'linear-gradient(90deg, #1e3a8a, #1e40af)', color: '#fff', whiteSpace: 'nowrap' }}>
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {!filtersApplied ? (
                <TableRow><TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4 }}>Choose dates and click Filter to load data.</TableCell></TableRow>
              ) : loading ? (
                [...Array(8)].map((_, i) => (
                  <TableRow key={i}>{COLUMNS.map((c) => <TableCell key={c}><Skeleton /></TableCell>)}</TableRow>
                ))
              ) : reports.length === 0 ? (
                <TableRow><TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4 }}>No records found.</TableCell></TableRow>
              ) : (
                reports.map((row, index) => (
                  <TableRow key={`${row.Account}-${index}`} hover>
                    {COLUMNS.map((column) => (
                      <TableCell key={column} sx={{ whiteSpace: 'nowrap', maxWidth: 220 }} title={row[column] != null ? String(row[column]) : ''}>
                        {row[column] ?? ''}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {filtersApplied && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={pagination.totalPages || 1} page={pagination.page} onChange={(_, v) => setPagination((p) => ({ ...p, page: v }))} color="primary" showFirstButton showLastButton />
        </Box>
      )}
    </Box>
  );
};

export default ActiveSubscriptionCustomerReport;
