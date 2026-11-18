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

const API_URL = getApiBaseUrl();

const TABLE_HEADERS = [
  'Name',
  'Customer Code',
  'Account Number',
  'Account Classification',
  'Contact Sales Model',
  'Tags',
  'Address Name',
  'Address Line1',
  'Address Line2',
  'City',
  'Service Provider',
  'Invoiced Service',
  'Invoice Number',
  'Reference Numbers',
  'Posted Date',
  'Issued Date',
  'Due Date',
  'Payment Methods',
  'Total Default Currency',
  'Total Net Amount',
  'Total Discount',
  'Total Tax',
  'Currency',
  'Total Amount',
  'Exchange Rate',
];

const HdcReports = () => {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [error, setError] = useState('');
  const isSmallScreen = useMediaQuery('(max-width:600px)');
  const isFetchingRef = useRef(false);

  const buildQuery = useCallback((filters, page, limit, format) => {
    let url = `${API_URL}/hdcReports?page=${page}&limit=${limit}&format=${format}`;
    url += `&startDate=${encodeURIComponent(filters.startDate)}`;
    url += `&endDate=${encodeURIComponent(filters.endDate)}`;
    return url;
  }, []);

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
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch reports');
      }
      setReports(data.data || []);
      setPagination({
        page,
        limit,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      });
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
    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date cannot be after end date.');
      return;
    }

    setError('');
    setAppliedFilters({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    });
    setFiltersApplied(true);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setAppliedFilters(null);
    setFiltersApplied(false);
    setReports([]);
    setError('');
    setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
  };

  const handlePageChange = (_, value) => {
    setPagination((prev) => ({ ...prev, page: value }));
  };

  const handleDownloadCSV = async () => {
    if (!appliedFilters) {
      setError('Select start and end date, then click Filter before downloading.');
      return;
    }

    setIsDownloading(true);
    setError('');
    try {
      const response = await fetch(buildQuery(appliedFilters, 1, 10, 'csv'), {
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
      link.setAttribute('download', 'hdc-report.csv');
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
          HDC Reports
        </Typography>
        <Button
          variant="contained"
          startIcon={<GetApp />}
          disabled={isDownloading || !filtersApplied}
          onClick={handleDownloadCSV}
          sx={{ backgroundColor: '#22c55e' }}
        >
          {isDownloading ? 'Exporting...' : 'Download CSV'}
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Select a start and end date, then click Filter to load the report (posted date range).
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
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
                InputLabelProps: { shrink: true },
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
                InputLabelProps: { shrink: true },
              },
            }}
          />
          <Button variant="contained" onClick={handleFilter} startIcon={<FilterAltIcon />}>
            Filter
          </Button>
          <Button variant="outlined" onClick={handleClearFilter} startIcon={<ClearIcon />}>
            Clear
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
            '&::-webkit-scrollbar': { height: 6, width: 6 },
            '&::-webkit-scrollbar-thumb': { backgroundColor: '#94a3b8', borderRadius: 3 },
          }}
        >
          <Table stickyHeader size="small" sx={{ minWidth: 2200 }}>
            <TableHead>
              <TableRow>
                {TABLE_HEADERS.map((header) => (
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
              {!filtersApplied ? (
                <TableRow>
                  <TableCell colSpan={TABLE_HEADERS.length} align="center" sx={{ py: 4, color: '#64748b' }}>
                    Choose dates and click Filter to load data.
                  </TableCell>
                </TableRow>
              ) : loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={index}>
                    {TABLE_HEADERS.map((header) => (
                      <TableCell key={header} sx={{ py: 1.5 }}>
                        <Skeleton variant="text" animation="wave" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={TABLE_HEADERS.length} align="center" sx={{ py: 4, color: '#64748b' }}>
                    No records found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report, index) => (
                  <TableRow
                    key={`${report['Account Number'] || index}-${report['Invoice Number'] || index}`}
                    hover
                    sx={{ '&:hover': { backgroundColor: '#f1f5f9' } }}
                  >
                    {TABLE_HEADERS.map((key) => (
                      <TableCell
                        key={key}
                        sx={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 220,
                          py: 1.5,
                          px: 2,
                          color: '#475569',
                          fontWeight: key === 'Name' ? 500 : 400,
                        }}
                        title={report[key] != null ? String(report[key]) : ''}
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

      {filtersApplied && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, pb: 1 }}>
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

export default HdcReports;
