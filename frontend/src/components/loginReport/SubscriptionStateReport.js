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
import { getApiBaseUrl, getAuthHeaders } from '../../utils/auth';

const COLUMNS = ['Account Number', 'State', 'Last Active Date', 'Tags'];

const SubscriptionStateReport = () => {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const isFetchingRef = useRef(false);

  const API_URL = getApiBaseUrl();

  const buildQuery = useCallback((filters, page, limit, format) => {
    let url = `${API_URL}/sales-reports/subscription-state?page=${page}&limit=${limit}&format=${format}`;
    if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
    if (filters.state) url += `&state=${encodeURIComponent(filters.state)}`;
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
    if (!appliedFilters) return;
    fetchReports(appliedFilters, pagination.page, pagination.limit);
  }, [appliedFilters, pagination.page, pagination.limit, fetchReports]);

  const handleFilter = () => {
    setAppliedFilters({ search: searchTerm.trim(), state: selectedState });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilter = () => {
    setSearchTerm('');
    setSelectedState('');
    setAppliedFilters(null);
    setReports([]);
    setError('');
    setPagination({ page: 1, limit: 20, totalItems: 0, totalPages: 0 });
  };

  const handleDownload = async () => {
    if (!appliedFilters) return;
    setIsDownloading(true);
    setError('');
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
      link.download = 'subscription-state-report.csv';
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
          Subscription State Report
        </Typography>
        <Button
          variant="contained"
          startIcon={<GetApp />}
          disabled={isDownloading || !appliedFilters}
          onClick={handleDownload}
          sx={{ backgroundColor: '#22c55e', '&:hover': { backgroundColor: '#16a34a' } }}
        >
          {isDownloading ? 'Exporting...' : 'Download CSV'}
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        A customer is EFFECTIVE if at least one subscription package is EFFECTIVE; otherwise NOT EFFECTIVE.
        Last Active Date is the date the latest package stopped (for EFFECTIVE customers, the date the current package is paid up to). Click Filter to load.
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, p: 2, backgroundColor: '#fff', borderRadius: 2, boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)' }}>
        <TextField
          label="Account number (optional)"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleFilter(); }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>State</InputLabel>
          <Select label="State" value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="EFFECTIVE">Effective</MenuItem>
            <MenuItem value="NOT_EFFECTIVE">Not Effective</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<FilterAltIcon />} onClick={handleFilter}>Filter</Button>
        <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClearFilter}>Clear</Button>
        {appliedFilters && !loading && (
          <Typography sx={{ alignSelf: 'center', color: '#64748b' }}>
            {pagination.totalItems.toLocaleString()} customers
          </Typography>
        )}
      </Box>

      <Box sx={{ flex: 1, overflow: 'hidden', borderRadius: 2, backgroundColor: '#fff', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
        <TableContainer component={Paper} sx={{ height: '100%', overflow: 'auto' }}>
          <Table stickyHeader size="small">
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
              {!appliedFilters ? (
                <TableRow><TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4, color: '#64748b' }}>Click Filter to load data.</TableCell></TableRow>
              ) : loading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>{COLUMNS.map((c) => <TableCell key={c}><Skeleton /></TableCell>)}</TableRow>
                ))
              ) : reports.length === 0 ? (
                <TableRow><TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4, color: '#64748b' }}>No records found.</TableCell></TableRow>
              ) : (
                reports.map((row, index) => (
                  <TableRow key={`${row['Account Number']}-${index}`} hover>
                    <TableCell>{row['Account Number']}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.State}
                        sx={{
                          fontWeight: 600,
                          color: '#fff',
                          backgroundColor: row.State === 'EFFECTIVE' ? '#22c55e' : '#ef4444',
                        }}
                      />
                    </TableCell>
                    <TableCell>{row['Last Active Date']}</TableCell>
                    <TableCell>{row.Tags}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {appliedFilters && (
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

export default SubscriptionStateReport;
