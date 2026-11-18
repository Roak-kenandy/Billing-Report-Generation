import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  Pagination,
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

const DEFAULT_ORG_NAME = 'Maldives National Defence Force';

const COLUMNS = [
  'Name',
  'Contact Code',
  'Account Number',
  'Phone',
  'Packages',
  'Package States',
  'Active Packages Count',
  'Subscription Start',
  'Subscription End',
  'Device #',
  'Total Devices On Account',
  'STB Type',
  'Smartcard ID',
  'Settopbox Serial',
  'Barcode',
  'Client ID',
  'Atoll',
  'Island',
  'Inst. Address',
];

const OrganizationDeviceReport = () => {
  const [organizationName, setOrganizationName] = useState(DEFAULT_ORG_NAME);
  const [appliedName, setAppliedName] = useState('');
  const [reports, setReports] = useState([]);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const isFetchingRef = useRef(false);

  const API_URL = getApiBaseUrl();

  const buildQuery = useCallback((name, page, limit, format) => {
    let url = `${API_URL}/crm-reports/organization-devices?page=${page}&limit=${limit}&format=${format}`;
    url += `&organizationName=${encodeURIComponent(name)}`;
    return url;
  }, [API_URL]);

  const fetchReports = useCallback(async (name, page, limit) => {
    if (!name || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(buildQuery(name, page, limit, 'json'), {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to load report');
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

  const handleLoad = () => {
    const name = organizationName.trim();
    if (!name) {
      setError('Organization name is required.');
      return;
    }
    setError('');
    setAppliedName(name);
    setFiltersApplied(true);
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchReports(name, 1, pagination.limit);
  };

  const handleClear = () => {
    setOrganizationName(DEFAULT_ORG_NAME);
    setAppliedName('');
    setFiltersApplied(false);
    setReports([]);
    setError('');
    setPagination({ page: 1, limit: 25, totalItems: 0, totalPages: 0 });
  };

  const handlePageChange = (_, value) => {
    if (!appliedName) return;
    setPagination((prev) => ({ ...prev, page: value }));
    fetchReports(appliedName, value, pagination.limit);
  };

  const handleDownload = async () => {
    if (!appliedName) {
      setError('Click Load Report before downloading.');
      return;
    }
    setIsDownloading(true);
    setError('');
    try {
      const response = await fetch(buildQuery(appliedName, 1, 25, 'csv'), {
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
      link.download = 'organization-device-report.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
          Organization Device Report
        </Typography>
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

      <Alert severity="info" sx={{ mb: 2 }}>
        Lists every CRM contact matching the organization name, with all subscriptions and one row per device (all devices included).
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          mb: 2,
          p: 2,
          backgroundColor: '#fff',
          borderRadius: 2,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
        }}
      >
        <TextField
          label="Organization name (CRM contact name)"
          size="small"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          sx={{ minWidth: 360, flex: 1 }}
        />
        <Button variant="contained" startIcon={<FilterAltIcon />} onClick={handleLoad}>
          Load Report
        </Button>
        <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClear}>
          Clear
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflow: 'hidden', borderRadius: 2, backgroundColor: '#fff' }}>
        <TableContainer component={Paper} sx={{ height: '100%', overflow: 'auto' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 2000 }}>
            <TableHead>
              <TableRow>
                {COLUMNS.map((col) => (
                  <TableCell
                    key={col}
                    sx={{
                      fontWeight: 600,
                      background: 'linear-gradient(90deg, #1e3a8a, #1e40af)',
                      color: '#fff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {!filtersApplied ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4 }}>
                    Enter organization name and click Load Report.
                  </TableCell>
                </TableRow>
              ) : loading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {COLUMNS.map((col) => (
                      <TableCell key={col}><Skeleton /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4 }}>
                    No matching contacts or devices found.
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((row, index) => (
                  <TableRow key={`${row['Account Number']}-${row['Device #']}-${index}`} hover>
                    {COLUMNS.map((col) => (
                      <TableCell key={col} sx={{ whiteSpace: 'nowrap', maxWidth: 240 }}>
                        {row[col] ?? ''}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {filtersApplied && !loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={pagination.totalPages || 1}
            page={pagination.page}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};

export default OrganizationDeviceReport;
