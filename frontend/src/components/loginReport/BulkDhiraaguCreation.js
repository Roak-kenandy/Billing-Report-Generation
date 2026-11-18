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
  previewDhiraaguBulkCreation,
  bulkDhiraaguCreation,
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

const BulkDhiraaguCreation = () => {
  const [uploads, setUploads] = useState([]);
  const previewFileInputRef = useRef(null);
  const createFileInputRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [previewSummary, setPreviewSummary] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getAllBulkOperations(currentPage, itemsPerPage, 'Dhiraagu Bulk Creation');
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
      const result = await previewDhiraaguBulkCreation(file);
      setPreviewSummary(result);
      toast.success(
        `Preview ready: ${result.phones_to_process} phone(s) will receive ${result.plan} (MVR ${result.price})`
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

  const handleCreateUpload = async () => {
    const file = createFileInputRef.current?.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    const newRecord = {
      batch: `BATCH${Date.now().toString().slice(-4)}`,
      file_name: file.name,
      date: Math.floor(Date.now() / 1000),
      type: 'Dhiraagu Bulk Creation',
      status: 'running',
    };

    setUploads((prev) => [...prev, newRecord]);

    try {
      const result = await bulkDhiraaguCreation(file);

      if (result.partial || result.total_errors > 0) {
        toast.warning(
          `Completed with errors: ${result.total_created} created, ${result.total_skipped} skipped, ${result.total_errors} failed` +
          (result.results_truncated ? ` (showing first ${result.results_limit} of ${result.results_total} results)` : '')
        );
      } else {
        toast.success(
          `Successfully processed ${result.total_created} account(s)` +
          (result.total_skipped ? ` (${result.total_skipped} skipped — already had Videoclub)` : '')
        );
      }

      if (result.total_created > 0) {
        await createOperationRecord(newRecord);
      }

      setPreviewSummary(null);
      setUploads((prev) =>
        prev.map((rec) =>
          rec.batch === newRecord.batch ? { ...rec, status: 'completed' } : rec
        )
      );
    } catch (error) {
      console.error('Create error:', error);
      toast.error(getErrorMessage(error, 'Failed to create Dhiraagu accounts'));
      setUploads((prev) =>
        prev.map((rec) =>
          rec.batch === newRecord.batch ? { ...rec, status: 'failed' } : rec
        )
      );
    } finally {
      setIsProcessing(false);
      createFileInputRef.current.value = '';
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

  const getStatusColor = (status) => {
    if (status === 'ready_new_user' || status === 'ready_existing_user') return 'success';
    if (status === 'already_has_videoclub') return 'warning';
    if (status === 'error' || status === 'invalid_phone') return 'error';
    return 'default';
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
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
            Dhiraagu Bulk Creation
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Upload Excel/CSV with phone numbers to create CRM accounts and subscribe Videoclub 3 Months (MVR 280)
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            ref={previewFileInputRef}
            style={{ display: 'none' }}
            onChange={handlePreviewUpload}
          />
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            ref={createFileInputRef}
            style={{ display: 'none' }}
            onChange={handleCreateUpload}
          />
          <Button
            variant="outlined"
            startIcon={<Preview />}
            disabled={isProcessing}
            onClick={() => previewFileInputRef.current?.click()}
            sx={{ borderColor: '#1e3a8a', color: '#1e3a8a' }}
          >
            Preview
          </Button>
          <Button
            variant="contained"
            startIcon={<Description />}
            disabled={isProcessing}
            onClick={() => createFileInputRef.current?.click()}
            sx={{ backgroundColor: '#1e3a8a' }}
          >
            {isProcessing ? 'Processing...' : 'Create Accounts'}
          </Button>
        </Box>
      </Box>

      {isProcessing && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Processing bulk upload. Each phone creates contact, device, account, payment, and Videoclub subscription — this may take several minutes.
        </Alert>
      )}

      {previewSummary && (
        <Box sx={{ mb: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Plan: {previewSummary.plan} — MVR {previewSummary.price}.{' '}
            {previewSummary.phones_to_process} to process, {previewSummary.ready_new_users} new users,{' '}
            {previewSummary.ready_existing_users} existing users, {previewSummary.already_has_videoclub} already subscribed.
            {previewSummary.preview_truncated &&
              ` Showing first ${previewSummary.preview_limit} of ${previewSummary.preview_total} phones.`}
          </Alert>

          <TableContainer
            sx={{
              maxHeight: 240,
              backgroundColor: '#ffffff',
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Phone', 'Status', 'Action', 'Contact ID', 'Account ID'].map((header) => (
                    <TableCell key={header} sx={{ fontWeight: 600, backgroundColor: '#f3f4f6' }}>
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {previewSummary.preview.map((row) => (
                  <TableRow key={row.phone_number}>
                    <TableCell>{row.phone_number}</TableCell>
                    <TableCell>
                      <Chip size="small" label={row.status} color={getStatusColor(row.status)} />
                    </TableCell>
                    <TableCell>{row.action || '-'}</TableCell>
                    <TableCell>{row.contact_id || '-'}</TableCell>
                    <TableCell>{row.account_id || '-'}</TableCell>
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
        />
      </Box>
    </Box>
  );
};

export default BulkDhiraaguCreation;
