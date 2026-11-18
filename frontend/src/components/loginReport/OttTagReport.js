import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
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
  'Match',
  'Account Number',
  'Name',
  'Contact Code',
  'Phone',
  'Tags',
  'Account State',
  'Registered Date',
  'First Activation Date',
  'Packages In Range',
  'Package Amounts',
  'Balance',
  'Dealer',
  'Atoll',
  'Island',
];

const MATCH_COLOR = {
  Registered: 'info',
  Subscribed: 'success',
  'Registered & Subscribed': 'primary',
};

const OttTagReport = () => {
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [matchType, setMatchType] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [appliedFilters, setAppliedFilters] = useState(null);
  const isFetchingRef = useRef(false);

  const API_URL = getApiBaseUrl();

  const buildQuery = useCallback((filters, page, limit, responseFormat) => {
    let url = `${API_URL}/sales-reports/ott-tag?page=${page}&limit=${limit}&format=${responseFormat}`;
    url += `&startDate=${encodeURIComponent(filters.startDate)}`;
    url += `&endDate=${encodeURIComponent(filters.endDate)}`;
    if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
    if (filters.match) url += `&match=${encodeURIComponent(filters.match)}`;
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
      setSummary(data.summary || null);
      setPagination((prev) => ({
        ...prev,
        page,
        limit,
        totalItems: data.pagination?.totalItems || 0,
        totalPages: data.pagination?.totalPages || 0,
      }));
    } catch (err) {
      setReports([]);
      setSummary(null);
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
    if (startDate > endDate) {
      setError('Start date must be on or before end date.');
      return;
    }
    setError('');
    setAppliedFilters({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      search: searchTerm.trim(),
      match: matchType,
    });
    setFiltersApplied(true);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setSearchTerm('');
    setMatchType('');
    setAppliedFilters(null);
    setFiltersApplied(false);
    setReports([]);
    setSummary(null);
    setError('');
    setPagination({ page: 1, limit: 20, totalItems: 0, totalPages: 0 });
  };

  const handleDownload = async () => {
    if (!appliedFilters) {
      setError('Select dates and click Filter before downloading.');
      return;
    }
    setIsDownloading(true);
    try {
      const response = await fetch(buildQuery(appliedFilters, 1, 20, 'csv'), {
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
      link.download = `ott-tag-report-${appliedFilters.startDate}-to-${appliedFilters.endDate}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatCell = (column, value) => {
    if (column === 'Match') {
      return <Chip size="small" label={value || ''} color={MATCH_COLOR[value] || 'default'} />;
    }
    if (value == null) return '';
    return String(value);
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 37px)', overflow: 'hidden', background: '#f9fafb' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
            OTT Tag Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Customers tagged OTT who registered or started a subscription in the selected date range.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<GetApp />}
          disabled={isDownloading || !filtersApplied}
          onClick={handleDownload}
          sx={{ backgroundColor: '#1e3a8a' }}
        >
          {isDownloading ? 'Downloading...' : 'Download CSV'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, p: 2, backgroundColor: '#fff', borderRadius: 2 }}>
          <DatePicker
            label="Start Date *"
            value={startDate}
            onChange={setStartDate}
            slotProps={{ textField: { size: 'small', required: true } }}
          />
          <DatePicker
            label="End Date *"
            value={endDate}
            onChange={setEndDate}
            slotProps={{ textField: { size: 'small', required: true } }}
          />
          <TextField
            label="Search (optional)"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFilter(); }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Match (optional)</InputLabel>
            <Select label="Match (optional)" value={matchType} onChange={(e) => setMatchType(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="registered">Registered only</MenuItem>
              <MenuItem value="subscribed">Subscribed only</MenuItem>
              <MenuItem value="both">Registered & Subscribed</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<FilterAltIcon />} onClick={handleFilter}>Filter</Button>
          <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClearFilter}>Clear</Button>
        </Box>
      </LocalizationProvider>

      {summary && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip label={`Total: ${summary.filtered ?? summary.total}`} color="primary" />
          <Chip label={`Registered: ${summary.registered}`} color="info" variant="outlined" />
          <Chip label={`Subscribed: ${summary.subscribed}`} color="success" variant="outlined" />
          <Chip label={`Both: ${summary.both}`} variant="outlined" />
          <Chip label={`${summary.startDate} to ${summary.endDate}`} variant="outlined" />
        </Box>
      )}

      <Box sx={{ flex: 1, overflow: 'hidden', borderRadius: 2, backgroundColor: '#fff' }}>
        <TableContainer component={Paper} sx={{ height: '100%', overflow: 'auto' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1800 }}>
            <TableHead>
              <TableRow>
                {COLUMNS.map((column) => (
                  <TableCell
                    key={column}
                    sx={{
                      fontWeight: 600,
                      background: 'linear-gradient(90deg, #1e3a8a, #1e40af)',
                      color: '#fff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {!filtersApplied ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} sx={{ py: 4, color: '#64748b' }}>
                    Choose Start Date and End Date (e.g. 25 Oct to 3 Nov), then click Filter.
                  </TableCell>
                </TableRow>
              ) : loading ? (
                [...Array(8)].map((_, i) => (
                  <TableRow key={i}>
                    {COLUMNS.map((c) => (
                      <TableCell key={c}><Skeleton /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4 }}>
                    No OTT customers found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((row, index) => (
                  <TableRow key={`${row['Account Number']}-${index}`} hover>
                    {COLUMNS.map((column) => (
                      <TableCell
                        key={column}
                        title={row[column] != null ? String(row[column]) : ''}
                        sx={{
                          whiteSpace: 'nowrap',
                          maxWidth: column === 'Packages In Range' || column === 'Package Amounts' ? 360 : 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {formatCell(column, row[column])}
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
          <Pagination
            count={pagination.totalPages || 1}
            page={pagination.page}
            onChange={(_, value) => setPagination((prev) => ({ ...prev, page: value }))}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};

export default OttTagReport;
