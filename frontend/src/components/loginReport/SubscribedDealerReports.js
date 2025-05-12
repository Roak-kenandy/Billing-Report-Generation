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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import { GetApp } from '@mui/icons-material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';

const SubscribedDealerReports = () => {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const isSmallScreen = useMediaQuery('(max-width:600px)');
  const [atolls, setAtolls] = useState([]);
  const [selectedAtoll, setSelectedAtoll] = useState('');
  const [selectedIsland, setSelectedIsland] = useState('');
  const [appliedAtoll, setAppliedAtoll] = useState('');
  const [appliedIsland, setAppliedIsland] = useState('');

  // Initialize serviceProvider state with extracted value
  const roles = JSON.parse(localStorage.getItem('userRoles')) || [];
  const spRole = roles.find(role => role.startsWith('Service Provider'));
  const initialServiceProvider = spRole && spRole.includes(':') ? spRole.split(':')[1].trim() : '';
  const [serviceProvider, setServiceProvider] = useState(initialServiceProvider);

  // const API_URL = 'http://localhost:3003/billing-reports';
  const API_URL = 'https://mdnrpt.medianet.mv/billing-reports';
  const isFetchingRef = useRef(false);

  // Log serviceProvider for debugging
  useEffect(() => {
    console.log('Service Provider State:', serviceProvider);
  }, [serviceProvider]);

  // Memoize fetchReports
  const fetchReports = useCallback(
    async (page, limit, search = '', start = '', end = '', atoll = '', island = '', sp = '') => {
      if (isFetchingRef.current) {
        console.log('Skipping fetch: already in progress');
        return;
      }
      isFetchingRef.current = true;

      console.log('Fetching reports with payload:', { page, limit, search, start, end, atoll, island, sp });
      setLoading(true);
      try {
        const safePage = page || 1;
        const safeLimit = limit || 10;
        let url = `${API_URL}/customerDealers?page=${safePage}&limit=${safeLimit}&format=json`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (start) url += `&startDate=${encodeURIComponent(start)}`;
        if (end) url += `&endDate=${encodeURIComponent(end)}`;
        if (atoll) url += `&atoll=${encodeURIComponent(atoll)}`;
        if (island) url += `&island=${encodeURIComponent(island)}`;
        if (sp) url += `&serviceProvider=${encodeURIComponent(sp)}`;

        console.log('Constructed URL:', url); // Debug URL

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
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
        console.error('Error fetching reports:', err);
        setReports([]);
        setPagination({ page: page || 1, limit: limit || 10, totalItems: 0, totalPages: 0 });
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [API_URL]
  );

  const handleFilter = () => {
    setAppliedStartDate(startDate ? startDate.toISOString().split('T')[0] : '');
    setAppliedEndDate(endDate ? endDate.toISOString().split('T')[0] : '');
    setAppliedAtoll(selectedAtoll);
    setAppliedIsland(selectedIsland);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setAppliedStartDate('');
    setAppliedEndDate('');
    setSelectedAtoll('');
    setSelectedIsland('');
    setAppliedAtoll('');
    setAppliedIsland('');
    setSearchTerm('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  useEffect(() => {
    const atollName = appliedAtoll
      ? atolls.find(a => a.atolls_id === appliedAtoll)?.atolls_name || ''
      : '';
    const islandName = appliedIsland
      ? atolls
          .find(a => a.atolls_id === appliedAtoll)
          ?.islands.find(i => i.islands_id === appliedIsland)?.islands_name || ''
      : '';
    fetchReports(
      pagination.page,
      pagination.limit,
      searchTerm,
      appliedStartDate,
      appliedEndDate,
      atollName,
      islandName,
      serviceProvider
    );
  }, [
    fetchReports,
    pagination.page,
    pagination.limit,
    searchTerm,
    appliedStartDate,
    appliedEndDate,
    appliedAtoll,
    appliedIsland,
    atolls,
    serviceProvider,
  ]);

  const handlePageChange = (event, value) => {
    setPagination(prev => {
      const newPagination = { ...prev, page: value };
      console.log('Updated pagination:', newPagination);
      return newPagination;
    });
  };

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleDownloadCSV = async () => {
    try {
      setIsDownloading(true);
      let url = `${API_URL}/customerDealers?format=csv`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (appliedStartDate) url += `&startDate=${encodeURIComponent(appliedStartDate)}`;
      if (appliedEndDate) url += `&endDate=${encodeURIComponent(appliedEndDate)}`;
      if (appliedAtoll) {
        const selectedAtollName = atolls.find(a => a.atolls_id === appliedAtoll)?.atolls_name;
        if (selectedAtollName) url += `&atoll=${encodeURIComponent(selectedAtollName)}`;
      }
      if (appliedIsland) {
        const selectedAtollData = atolls.find(a => a.atolls_id === appliedAtoll);
        const selectedIslandName = selectedAtollData?.islands.find(i => i.islands_id === appliedIsland)?.islands_name;
        if (selectedIslandName) url += `&island=${encodeURIComponent(selectedIslandName)}`;
      }
      if (serviceProvider) url += `&serviceProvider=${encodeURIComponent(serviceProvider)}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'customer_reports.csv');
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

  // Map backend field names to frontend display keys
  const fieldMap = {
    'Account Number': 'Account Number',
    'Customer Name': 'Customer Name',
    Mobile: 'Mobile',
    'Tag Area': 'Area',
    Island: 'Island',
    Atoll: 'Atoll',
    Ward: 'Ward',
    Road: 'Road',
    'Device Name': 'STB',
    'Service Provider': 'Service Provider',
    'Account Status': 'Account Status',
    'Service Status': 'Status',
    'Service Package': 'Package',
    'Service End Date': 'End Date',
  };

  // Fields that may have multiple values
  const multiValueFields = ['Service Status', 'Service Package', 'Service End Date'];

  // Format date to "dd MMM yyyy"
  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
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
            disabled={isDownloading}
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
          <Table stickyHeader sx={{ minWidth: isSmallScreen ? 'auto' : 1600 }}>
            <TableHead>
              <TableRow>
                {Object.values(fieldMap).map((header) => (
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
                    {Array.from({ length: Object.keys(fieldMap).length }).map((_, cellIndex) => (
                      <TableCell key={cellIndex} sx={{ py: 2 }}>
                        <Skeleton variant="text" animation="wave" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={Object.keys(fieldMap).length}
                    sx={{ textAlign: 'center', py: 4, color: '#64748b' }}
                  >
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow
                    key={report.id}
                    hover
                    sx={{
                      '&:last-child td': { borderBottom: 0 },
                      transition: 'background-color 0.2s ease',
                      '&:hover': { backgroundColor: '#f1f5f9' },
                    }}
                  >
                    {Object.keys(fieldMap).map((backendKey) => {
                      let displayValue = report[backendKey] || '-';

                      if (multiValueFields.includes(backendKey)) {
                        if (Array.isArray(displayValue)) {
                          displayValue = displayValue
                            .map((val) =>
                              backendKey.includes('Date') ? formatDate(val) : val
                            )
                            .join(', ');
                        } else if (typeof displayValue === 'string' && displayValue.includes(',')) {
                          displayValue = displayValue
                            .split(',')
                            .map((val) =>
                              backendKey.includes('Date') ? formatDate(val.trim()) : val.trim()
                            )
                            .join(', ');
                        } else if (backendKey.includes('Date') && displayValue !== '-') {
                          displayValue = formatDate(displayValue);
                        }
                      }

                      if (backendKey === 'Service Provider' || backendKey === 'Customer Code') {
                        displayValue =
                          displayValue && typeof displayValue === 'object'
                            ? displayValue.value_label || '-'
                            : displayValue || '-';
                      } else if (backendKey === 'Submitted By User' || backendKey === 'Area') {
                        displayValue = '-';
                      }

                      return (
                        <TableCell
                          key={backendKey}
                          sx={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 200,
                            py: 2,
                            px: 2,
                            color:
                              backendKey === 'Service Status' && displayValue.includes('NOT_EFFECTIVE')
                                ? '#ef4444'
                                : backendKey === 'Service Status' && displayValue.includes('EFFECTIVE')
                                ? '#22c55e'
                                : '#475569',
                            fontWeight: ['Customer Name'].includes(backendKey) ? 500 : 400,
                          }}
                        >
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

export default SubscribedDealerReports;