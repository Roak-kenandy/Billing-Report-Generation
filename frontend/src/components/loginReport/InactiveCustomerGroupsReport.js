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
import RefreshIcon from '@mui/icons-material/Refresh';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/auth';

const GROUP_LAST_ACTIVE = 'LAST_ACTIVE_ON_OR_BEFORE_2026_07_30';
const GROUP_FIFA_FREE = 'FIFA_FREE_NO_NEW_PACKAGE';

const COLUMNS = [
  'Group', 'Account Number', 'Name', 'Contact Code', 'Phone', 'Tags', 'Account State',
  'Last Active Date', 'Last Package', 'FIFA Free Start', 'FIFA Free End', 'Balance',
  'Dealer', 'Atoll', 'Island',
];

const InactiveCustomerGroupsReport = () => {
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 0 });
  const [selectedGroup, setSelectedGroup] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const isFetchingRef = useRef(false);

  const API_URL = getApiBaseUrl();

  const buildQuery = useCallback((filters, page, limit, format) => {
    let url = `${API_URL}/sales-reports/inactive-customer-groups?page=${page}&limit=${limit}&format=${format}`;
    if (filters.group) url += `&group=${encodeURIComponent(filters.group)}`;
    if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
    if (filters.refresh) url += '&refresh=true';
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

  const applyFilters = (refresh = false) => {
    setAppliedFilters({ group: selectedGroup, search: searchTerm.trim(), refresh });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilter = () => {
    setSelectedGroup('');
    setSearchTerm('');
    setAppliedFilters(null);
    setReports([]);
    setSummary(null);
    setError('');
    setPagination({ page: 1, limit: 20, totalItems: 0, totalPages: 0 });
  };

  const handleDownload = async () => {
    if (!appliedFilters) return;
    setIsDownloading(true);
    setError('');
    try {
      const response = await fetch(buildQuery({ ...appliedFilters, refresh: false }, 1, 20, 'csv'), {
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
      link.download = 'inactive-customer-groups-report.csv';
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
          Inactive Customer Groups Report
        </Typography>
        <Button
          variant="contained"
          startIcon={<GetApp />}
          disabled={isDownloading || !appliedFilters || loading}
          onClick={handleDownload}
          sx={{ backgroundColor: '#22c55e', '&:hover': { backgroundColor: '#16a34a' } }}
        >
          {isDownloading ? 'Exporting...' : 'Download CSV'}
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Active accounts only, with no EFFECTIVE package today.
        Group 1: last active date on or before 30 Jul 2026.
        Group 2: had the FIFA 2026 [FREE] - MTV package and took no new package after it.
        The first load can take up to a minute; results are then cached for 10 minutes.
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2, p: 2, backgroundColor: '#fff', borderRadius: 2, boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)' }}>
        <FormControl size="small" sx={{ minWidth: 300 }}>
          <InputLabel>Customer group</InputLabel>
          <Select label="Customer group" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
            <MenuItem value="">Both groups</MenuItem>
            <MenuItem value={GROUP_LAST_ACTIVE}>Last active on or before 30 Jul 2026</MenuItem>
            <MenuItem value={GROUP_FIFA_FREE}>FIFA FREE - no new package</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Search (optional)"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
        />
        <Button variant="contained" startIcon={<FilterAltIcon />} onClick={() => applyFilters()} disabled={loading}>Filter</Button>
        <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClearFilter} disabled={loading}>Clear</Button>
        <Button variant="text" startIcon={<RefreshIcon />} onClick={() => applyFilters(true)} disabled={loading || !appliedFilters}>
          Refresh data
        </Button>
        {summary && !loading && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`Last active ≤ 30 Jul: ${summary[GROUP_LAST_ACTIVE].toLocaleString()}`} />
            <Chip size="small" label={`FIFA FREE no new package: ${summary[GROUP_FIFA_FREE].toLocaleString()}`} />
            <Chip size="small" variant="outlined" label={`Showing ${pagination.totalItems.toLocaleString()}`} />
          </Box>
        )}
      </Box>

      <Box sx={{ flex: 1, overflow: 'hidden', borderRadius: 2, backgroundColor: '#fff', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
        <TableContainer component={Paper} sx={{ height: '100%', overflow: 'auto' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 2000 }}>
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
                <TableRow><TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4, color: '#64748b' }}>Choose a group and click Filter to load data.</TableCell></TableRow>
              ) : loading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>{COLUMNS.map((c) => <TableCell key={c}><Skeleton /></TableCell>)}</TableRow>
                ))
              ) : reports.length === 0 ? (
                <TableRow><TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4, color: '#64748b' }}>No records found.</TableCell></TableRow>
              ) : (
                reports.map((row, index) => (
                  <TableRow key={`${row['Contact Code']}-${index}`} hover>
                    {COLUMNS.map((column) => (
                      <TableCell key={column} sx={{ whiteSpace: 'nowrap', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={row[column] != null ? String(row[column]) : ''}>
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

      {appliedFilters && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={pagination.totalPages || 1}
            page={pagination.page}
            onChange={(_, value) => {
              setAppliedFilters((prev) => (prev?.refresh ? { ...prev, refresh: false } : prev));
              setPagination((prev) => ({ ...prev, page: value }));
            }}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};

export default InactiveCustomerGroupsReport;
