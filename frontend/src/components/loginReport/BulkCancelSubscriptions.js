import { useState, useRef, useEffect } from 'react';
import {
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  Box,
  Skeleton,
  Chip,
  Alert,
} from '@mui/material';
import { Description, CheckCircle, Autorenew, Preview } from '@mui/icons-material';
import { toast } from 'react-toastify';
import {
  previewCancelSubscriptions,
  bulkCancelSubscriptions,
  createOperationRecord,
  getAllBulkOperations,
} from '../../service/apiService';

const getErrorMessage = (error, fallback) => {
    if (error.response?.data?.message) {
        return error.response.data.message;
    }

    if (error.response?.status === 404) {
        return 'API endpoint not found. Make sure the backend is running locally on port 3003 with the latest code.';
    }

    if (error.code === 'ERR_NETWORK' || !error.response) {
        return 'Could not reach the backend API. Check that the server is running and REACT_APP_API_URL is set correctly.';
    }

    if (error.code === 'ECONNABORTED') {
        return 'Request timed out. Large files can take up to 90 minutes — check backend logs to see if processing still completed.';
    }

    return fallback;
};

const BulkCancelSubscriptions = () => {
  const [uploads, setUploads] = useState([]);
  const previewFileInputRef = useRef(null);
  const cancelFileInputRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [previewSummary, setPreviewSummary] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getAllBulkOperations(currentPage, itemsPerPage, 'Cancel Subscriptions');
      setUploads(result.data.reports);
      setTotalPages(result.data.totalPages);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, itemsPerPage]);

  const handlePreviewUpload = async () => {
    const file = previewFileInputRef.current?.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const result = await previewCancelSubscriptions(file);
      setPreviewSummary(result);
      toast.success(
        `Preview ready: ${result.total_services_to_cancel} service(s) across ${result.contacts_with_services_to_cancel} contact(s)`
      );
    } catch (error) {
      console.error('Preview error:', error);
      toast.error(getErrorMessage(error, 'Failed to generate preview'));
      setPreviewSummary(null);
    } finally {
      setIsProcessing(false);
      previewFileInputRef.current.value = '';
    }
  };

  const handleCancelUpload = async () => {
    const file = cancelFileInputRef.current?.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    const newRecord = {
      batch: `BATCH${Date.now().toString().slice(-4)}`,
      file_name: file.name,
      date: Math.floor(Date.now() / 1000),
      type: 'Cancel Subscriptions',
      status: 'running',
    };

    setUploads((prev) => [...prev, newRecord]);

    try {
      const result = await bulkCancelSubscriptions(file);

      if (result.partial || result.total_errors > 0) {
        toast.warning(
          `Completed with errors: ${result.total_cancelled} cancelled, ${result.total_errors} failed` +
          (result.results_truncated ? ` (showing first ${result.results_limit} of ${result.results_total} results)` : '')
        );
      } else {
        toast.success(
          `Successfully cancelled ${result.total_cancelled} service(s)` +
          (result.results_truncated ? ` (${result.results_total} contacts processed)` : '')
        );
      }

      if (result.total_cancelled > 0) {
        await createOperationRecord(newRecord);
      }

      setPreviewSummary(null);
      setUploads((prev) =>
        prev.map((rec) =>
          rec.batch === newRecord.batch ? { ...rec, status: 'completed' } : rec
        )
      );
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error(getErrorMessage(error, 'Failed to cancel subscriptions'));
      setUploads((prev) =>
        prev.map((rec) =>
          rec.batch === newRecord.batch ? { ...rec, status: 'failed' } : rec
        )
      );
    } finally {
      setIsProcessing(false);
      cancelFileInputRef.current.value = '';
      fetchData();
    }
  };

  const formatDate = (unixTimestamp) => {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
          mb: 3,
          p: 2,
          backgroundColor: '#ffffff',
          borderRadius: 2,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
            Bulk Cancel Subscriptions
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            Upload a CSV or Excel file with a Contact Code column. The contact&apos;s CRM account balance and overdue
            amount must be zero. Only services in NOT_EFFECTIVE or DRAFT are cancelled.
            Large files are processed in controlled batches to protect the CRM API.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {isProcessing && (
            <Typography variant="body2" sx={{ color: '#1e3a8a', fontWeight: 500 }}>
              Processing... large uploads may take several minutes.
            </Typography>
          )}
          <Button
            component="label"
            variant="contained"
            startIcon={<Preview />}
            disabled={isProcessing}
            sx={{
              height: 48,
              borderRadius: 2,
              backgroundColor: '#3b82f6',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': { backgroundColor: '#2563eb' },
            }}
          >
            Preview CSV
            <input
              type="file"
              hidden
              accept=".csv,.xlsx"
              ref={previewFileInputRef}
              onChange={handlePreviewUpload}
            />
          </Button>
          <Button
            component="label"
            variant="contained"
            startIcon={<Description />}
            disabled={isProcessing}
            sx={{
              height: 48,
              borderRadius: 2,
              backgroundColor: '#ef4444',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': { backgroundColor: '#dc2626' },
            }}
          >
            Cancel Subscriptions
            <input
              type="file"
              hidden
              accept=".csv,.xlsx"
              ref={cancelFileInputRef}
              onChange={handleCancelUpload}
            />
          </Button>
        </Box>
      </Box>

      {previewSummary && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Preview: {previewSummary.total_contacts} contact(s),{' '}
          {previewSummary.contacts_with_services_to_cancel} with cancellable services (NOT_EFFECTIVE / DRAFT),{' '}
          {previewSummary.total_services_to_cancel} service(s) to cancel.
          {previewSummary.contacts_with_balance > 0 && (
            <> {previewSummary.contacts_with_balance} skipped — account balance must be zero.</>
          )}
          {previewSummary.preview_truncated && (
            <> Showing first {previewSummary.preview_limit} of {previewSummary.preview_total} contacts.</>
          )}
        </Alert>
      )}

      {previewSummary?.preview?.length > 0 && (
        <Box
          sx={{
            mb: 2,
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            backgroundColor: '#ffffff',
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Contact Code', 'Account', 'Balance', 'Status', 'Subscriptions', 'Services'].map((header) => (
                    <TableCell key={header} sx={{ fontWeight: 600 }}>{header}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {previewSummary.preview.map((row) => (
                  <TableRow key={row.contact_code}>
                    <TableCell>{row.contact_code}</TableCell>
                    <TableCell>{row.account_number || row.account_id || '-'}</TableCell>
                    <TableCell>
                      {row.balance !== null && row.balance !== undefined ? row.balance : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.status}
                        color={
                          row.status === 'ready'
                            ? 'success'
                            : row.status === 'error'
                              ? 'error'
                              : row.status === 'has_balance'
                                ? 'warning'
                                : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>{row.subscriptions.length}</TableCell>
                    <TableCell>
                      {row.subscriptions.reduce((sum, sub) => sum + sub.services.length, 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
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
          sx={{
            height: '100%',
            overflow: 'auto',
            borderRadius: 2,
          }}
        >
          <Table stickyHeader sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                {['Batch #', 'Filename', 'Date', 'Status'].map((header) => (
                  <TableCell
                    key={header}
                    sx={{
                      fontWeight: 600,
                      background: 'linear-gradient(90deg, #1e3a8a, #1e40af)',
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                      py: 1.5,
                      px: 2,
                    }}
                  >
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: 4 }).map((_, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton variant="text" animation="wave" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                uploads.map((upload) => (
                  <TableRow key={upload.batch} hover>
                    <TableCell>{upload.batch}</TableCell>
                    <TableCell>{upload.file_name}</TableCell>
                    <TableCell>{formatDate(upload.date)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {upload.status === 'running' ? (
                          <Autorenew sx={{ color: '#1e3a8a' }} />
                        ) : (
                          <CheckCircle sx={{ color: '#22c55e' }} />
                        )}
                        {upload.status}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, pb: 2 }}>
        <Pagination
          count={totalPages}
          page={currentPage}
          onChange={(e, page) => setCurrentPage(page)}
          color="primary"
          showFirstButton
          showLastButton
        />
      </Box>
    </Box>
  );
};

export default BulkCancelSubscriptions;
