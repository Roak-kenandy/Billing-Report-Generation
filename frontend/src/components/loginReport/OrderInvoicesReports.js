import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@mui/material';
import { GetApp } from '@mui/icons-material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';

const OrderInvoicesReports = () => {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const isSmallScreen = useMediaQuery('(max-width:600px)');

//   const API_URL = 'http://localhost:3003/billing-reports';
  const API_URL = 'https://mdnrpt.medianet.mv/billing-reports';
  const isFetchingRef = useRef(false);

  // Memoize fetchReports
  const fetchReports = useCallback(
    async (page, limit, start = '', end = '') => {
      if (isFetchingRef.current) {
        console.log('Skipping fetch: already in progress');
        return;
      }
      isFetchingRef.current = true;
      setLoading(true);

      try {
        const safePage = page || 1;
        const safeLimit = limit || 10;
        let url = `${API_URL}/orderInvoiceInformation?page=${safePage}&limit=${safeLimit}&format=json`;
        if (start) url += `&startDate=${encodeURIComponent(start)}`;
        if (end) url += `&endDate=${encodeURIComponent(end)}`;

        console.log('Constructed URL:', url);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log('Backend response:', data);

        const defaultPagination = { page: safePage, limit: safeLimit, totalItems: 0, totalPages: 0 };
        const backendPagination = data.pagination || defaultPagination;
        const updatedPagination = {
          ...backendPagination,
          page: safePage,
          limit: safeLimit,
        };

        setReports(data.data || []);
        setPagination(updatedPagination);
      } catch (err) {
        console.error('Error fetching registration reports:', err);
        setReports([]);
        setPagination({ page: page || 1, limit: limit || 10, totalItems: 0, totalPages: 0 });
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [API_URL]
  );

  // Fetch reports when dependencies change
  useEffect(() => {
    fetchReports(
      pagination.page,
      pagination.limit,
      appliedStartDate,
      appliedEndDate
    );
  }, [
    fetchReports,
    pagination.page,
    pagination.limit,
    appliedStartDate,
    appliedEndDate,
  ]);

  const handleFilter = () => {
    setAppliedStartDate(startDate ? startDate.toISOString().split('T')[0] : '');
    setAppliedEndDate(endDate ? endDate.toISOString().split('T')[0] : '');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setAppliedStartDate('');
    setAppliedEndDate('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (event, value) => {
    setPagination(prev => {
      const newPagination = { ...prev, page: value };
      console.log('Updated pagination:', newPagination);
      return newPagination;
    });
  };

  const handleDownloadCSV = async () => {
    try {
      setIsDownloading(true);
      let url = `${API_URL}/orderInvoiceInformation?format=csv`;
      if (appliedStartDate) url += `&startDate=${encodeURIComponent(appliedStartDate)}`;
      if (appliedEndDate) url += `&endDate=${encodeURIComponent(appliedEndDate)}`;

      console.log('CSV Download URL:', url);

      const response = await fetch(url);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'orders_invoice_information.csv');
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

  const fieldMap = {
    'Account Number': 'Account Number',
    'Customer Code': 'Customer Code',
    'Customer Name': 'Customer Name',
    'Product Name': 'Product Name',
    'Product Type': 'Product Type',
    'Quantity': 'Quantity',
    'Total': 'Total',
    'Order State': 'Order State',
    'Order Notes': 'Order Notes',
    'Submitted By User Name': 'Submitted By User Name',
    'Order Date': 'Order Date',
    'Order Number': 'Order Number',
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '-') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  };

  const formatDate = (dateStr) => {
    try {
      if (!dateStr || dateStr === '-') return '-';
      return format(new Date(dateStr), 'dd MMM yyyy HH:mm:ss');
    } catch {
      return dateStr;
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 37px)', overflow: 'hidden', background: '#f9fafb' }}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{
          display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 3, p: 2,
          backgroundColor: '#ffffff', borderRadius: 2, boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
          '& > *': { minWidth: isSmallScreen ? '100%' : 'auto' }
        }}>
          <DatePicker
            label="Start Date"
            value={startDate}
            onChange={(newValue) => setStartDate(newValue)}
            slotProps={{
              textField: {
                InputLabelProps: { shrink: true },
                sx: {
                  width: isSmallScreen ? '100%' : 180,
                  '& .MuiOutlinedInput-root': { borderRadius: 2, backgroundColor: '#f1f5f9' },
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
                  '& .MuiOutlinedInput-root': { borderRadius: 2, backgroundColor: '#f1f5f9' },
                },
              },
            }}
          />
          <Button variant="contained" onClick={handleFilter} startIcon={<FilterAltIcon />} sx={{
            width: isSmallScreen ? '100%' : 'auto', height: 48, borderRadius: 2, backgroundColor: '#3b82f6',
            textTransform: 'none', fontWeight: 500, transition: 'all 0.3s ease',
            '&:hover': { backgroundColor: '#2563eb', transform: 'translateY(-2px)' },
          }}>Filter</Button>
          <Button variant="outlined" onClick={handleClearFilter} startIcon={<ClearIcon />} sx={{
            width: isSmallScreen ? '100%' : 'auto', height: 48, borderRadius: 2,
            borderColor: '#e2e8f0', color: '#64748b', textTransform: 'none', fontWeight: 500,
            transition: 'all 0.3s ease',
            '&:hover': { borderColor: '#3b82f6', color: '#3b82f6', transform: 'translateY(-2px)' },
          }}>Clear Filters</Button>
          <Button variant="contained" onClick={handleDownloadCSV} startIcon={!isSmallScreen && <GetApp />} disabled={isDownloading} sx={{
            width: isSmallScreen ? '100%' : 'auto', height: 48, borderRadius: 2,
            backgroundColor: '#22c55e', textTransform: 'none', fontWeight: 500,
            transition: 'all 0.3s ease',
            '&:hover': { backgroundColor: '#16a34a', transform: 'translateY(-2px)' },
          }}>
            {isDownloading ? 'Exporting...' : isSmallScreen ? <GetApp /> : 'Download'}
          </Button>
        </Box>
      </LocalizationProvider>

      <Box sx={{ flex: 1, overflow: 'hidden', borderRadius: 2, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', backgroundColor: '#ffffff' }}>
        <TableContainer component={Paper} sx={{
          height: '100%', overflow: 'auto', borderRadius: 2,
          '&::-webkit-scrollbar': { height: 6, width: 6 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#94a3b8', borderRadius: 3 },
        }}>
          <Table stickyHeader sx={{ minWidth: isSmallScreen ? 'auto' : 1800 }}>
            <TableHead>
              <TableRow>
                {Object.values(fieldMap).map((header) => (
                  <TableCell key={header} sx={{
                    fontWeight: 600, background: 'linear-gradient(90deg, #1e3a8a, #1e40af)',
                    color: '#ffffff', whiteSpace: 'nowrap', py: 1.5, px: 2, borderBottom: 'none',
                  }}>{header}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: Object.keys(fieldMap).length }).map((_, cellIndex) => (
                      <TableCell key={cellIndex} sx={{ py: 2 }}>
                        <Skeleton variant="text" animation="wave" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={Object.keys(fieldMap).length} sx={{ textAlign: 'center', py: 4, color: '#64748b' }}>
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report, index) => (
                  <TableRow key={index} hover sx={{
                    '&:last-child td': { borderBottom: 0 },
                    transition: 'background-color 0.2s ease',
                    '&:hover': { backgroundColor: '#f1f5f9' },
                  }}>
                    {Object.keys(fieldMap).map((backendKey) => {
                      let displayValue = report[backendKey] || '-';

                      // Format currency fields
                      if (['Account Balance', 'Transaction Amount', 'Overdue Amount'].includes(backendKey)) {
                        displayValue = formatCurrency(displayValue);
                      }

                      // Format date fields
                      if (backendKey === 'Posted Date') {
                        displayValue = formatDate(displayValue);
                      }

                      // Format boolean fields
                      if (backendKey === 'Is Virtual Merchant') {
                        displayValue = displayValue === 'Yes' ? 'Yes' : 'No';
                      }

                      // Highlight Backoffice Code that starts with REG
                      const isRegCode = backendKey === 'Backoffice Code' && displayValue.startsWith('REG');

                      return (
                        <TableCell key={backendKey} sx={{
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200, py: 2, px: 2,
                          color: '#475569',
                          fontWeight: ['Merchant Name', 'Business Name'].includes(backendKey) ? 500 : 400,
                          backgroundColor: backendKey === 'Account Balance' && parseFloat(displayValue) < 0 ? '#fef2f2' : 
                                         isRegCode ? '#f0f9ff' : 'inherit',
                          color: backendKey === 'Account Balance' && parseFloat(displayValue) < 0 ? '#dc2626' : 
                                isRegCode ? '#0369a1' : '#475569',
                          borderLeft: isRegCode ? '3px solid #0369a1' : 'none',
                        }}>
                          {displayValue}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, pb: 2 }}>
        {loading ? (
          <Skeleton variant="rectangular" width={200} height={40} sx={{ borderRadius: 2 }} />
        ) : (
          <Pagination
            count={pagination.totalPages || 0}
            page={pagination.page || 1}
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

export default OrderInvoicesReports;