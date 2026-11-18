import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Chip,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
} from '@mui/material';
import { UploadFile, GetApp, StopCircle, DeleteForever } from '@mui/icons-material';
import { toast } from 'react-toastify';
import {
  previewBulkAccountTermination,
  startBulkAccountTermination,
  getBulkAccountTerminationJob,
  listBulkAccountTerminationJobs,
  stopBulkAccountTerminationJob,
  downloadBulkAccountTerminationCsv,
} from '../../service/apiService';

const POLL_INTERVAL_MS = 3000;
const CONFIRM_WORD = 'TERMINATE';

const STATUS_META = {
  ready: { label: 'Ready', color: 'success' },
  has_balance: { label: 'Has balance', color: 'warning' },
  has_effective_package: { label: 'Effective package', color: 'error' },
  has_rented_device: { label: 'Rented device', color: 'error' },
  already_terminated: { label: 'Already terminated', color: 'default' },
  not_found: { label: 'Not found', color: 'error' },
  account_contact_mismatch: { label: 'Account/contact mismatch', color: 'error' },
  ambiguous_account_number: { label: 'Duplicate account no.', color: 'error' },
};

const OUTCOME_COLOR = { terminated: 'success', skipped: 'warning', failed: 'error' };

const getErrorMessage = (error, fallback) => error.response?.data?.message || error.message || fallback;

const formatDateTime = (ms) => (ms ? new Date(ms).toLocaleString('en-GB') : '-');

const headerCellSx = { fontWeight: 600, backgroundColor: '#f3f4f6', whiteSpace: 'nowrap' };

const BulkAccountTermination = () => {
  const fileInputRef = useRef(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [job, setJob] = useState(null);
  const [jobs, setJobs] = useState([]);

  const refreshJobs = useCallback(async () => {
    try {
      const list = await listBulkAccountTerminationJobs();
      setJobs(list);
      const running = list.find((j) => j.status === 'running' || j.status === 'stopping');
      if (running) setJob((current) => current || running);
    } catch (error) {
      console.error('Failed to load termination jobs:', error);
    }
  }, []);

  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  const jobId = job?.job_id;
  const jobActive = job?.status === 'running' || job?.status === 'stopping';

  useEffect(() => {
    if (!jobId || !jobActive) return undefined;
    const timer = setInterval(async () => {
      try {
        const latest = await getBulkAccountTerminationJob(jobId);
        setJob(latest);
        if (latest.status !== 'running' && latest.status !== 'stopping') {
          toast.info(`Termination job ${latest.status}: ${latest.terminated} terminated, ${latest.skipped} skipped, ${latest.failed} failed`);
          refreshJobs();
        }
      } catch (error) {
        console.error('Failed to poll job:', error);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [jobId, jobActive, refreshJobs]);

  const handleFileSelected = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setIsPreviewing(true);
    setPreview(null);
    try {
      const result = await previewBulkAccountTermination(file);
      setPreview(result);
      toast.success(`Preview ready: ${result.summary.ready} account(s) can be terminated`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to generate preview'));
    } finally {
      setIsPreviewing(false);
      fileInputRef.current.value = '';
    }
  };

  const eligibleCount = preview ? preview.summary.ready : 0;

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const started = await startBulkAccountTermination(preview.preview_id);
      setJob(started);
      setPreview(null);
      setConfirmOpen(false);
      setConfirmText('');
      toast.success(`Termination started for ${started.total} account(s)`);
      refreshJobs();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to start termination'));
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    try {
      setJob(await stopBulkAccountTerminationJob(jobId));
      toast.info('Stopping after the accounts currently in progress finish');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to stop job'));
    }
  };

  const download = async (path, fileName) => {
    try {
      await downloadBulkAccountTerminationCsv(path, fileName);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Download failed'));
    }
  };

  const summary = preview?.summary;
  const progress = job && job.total ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 37px)', overflow: 'auto', background: '#f9fafb' }}>
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
        <Box sx={{ maxWidth: 820 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
            Bulk Account Termination
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Upload the Inactive Customer Groups file (columns <b>Account Number</b> and <b>Contact Code</b> are used).
            For every eligible account all remaining subscriptions (NOT_EFFECTIVE / DRAFT / PAUSED) are cancelled first,
            then the account is terminated in CRM with reason INACTIVITY. Accounts with an EFFECTIVE package, a rented
            device or any balance are never terminated.
          </Typography>
        </Box>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
        <Button
          variant="contained"
          startIcon={<UploadFile />}
          disabled={isPreviewing || jobActive}
          onClick={() => fileInputRef.current?.click()}
          sx={{ backgroundColor: '#1e3a8a' }}
        >
          {isPreviewing ? 'Checking accounts...' : 'Upload File'}
        </Button>
      </Box>

      {isPreviewing && <LinearProgress sx={{ mb: 2 }} />}

      {job && (
        <Box sx={{ mb: 3, p: 2, backgroundColor: '#ffffff', borderRadius: 2, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Job {job.job_id} – {job.file_name} – <Chip size="small" label={job.status} color={jobActive ? 'info' : 'default'} />
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {job.status === 'running' && (
                <Button size="small" color="error" variant="outlined" startIcon={<StopCircle />} onClick={handleStop}>
                  Stop
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<GetApp />}
                onClick={() => download(`jobs/${job.job_id}/results.csv`, `account-termination-results-${job.job_id}.csv`)}
              >
                Results CSV
              </Button>
            </Box>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ my: 1.5, height: 8, borderRadius: 4 }} />
          <Typography variant="body2" color="text.secondary">
            {job.processed} / {job.total} processed ({progress}%) · <b>{job.terminated}</b> terminated ·{' '}
            {job.skipped} skipped · {job.failed} failed · {job.services_cancelled} services cancelled
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            CRM API load: {job.crm_rate_per_second} / {job.crm_max_rate_per_second} requests per second ·{' '}
            {job.crm_requests} requests · throttled {job.crm_throttled}× · cool-downs {job.crm_cooldowns}
            {job.crm_paused_until && ` · paused until ${new Date(job.crm_paused_until).toLocaleTimeString('en-GB')} to let CRM recover`}
          </Typography>
          {job.error && <Alert severity="error" sx={{ mt: 1 }}>{job.error}</Alert>}
          {job.recent_results?.length > 0 && (
            <TableContainer sx={{ maxHeight: 260, mt: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Account Number', 'Contact Code', 'Name', 'Outcome', 'Reason', 'Message', 'Cancelled Services'].map((h) => (
                      <TableCell key={h} sx={headerCellSx}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {job.recent_results.map((r) => (
                    <TableRow key={`${r.contact_id}-${r.account_id}`}>
                      <TableCell>{r.account_number}</TableCell>
                      <TableCell>{r.contact_code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell><Chip size="small" label={r.outcome} color={OUTCOME_COLOR[r.outcome]} /></TableCell>
                      <TableCell>{r.reason}</TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>{r.message}</TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>{r.cancelled_services?.join('; ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {preview && (
        <Box sx={{ mb: 3, p: 2, backgroundColor: '#ffffff', borderRadius: 2, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Preview – {preview.file_name} ({summary.total_rows} accounts)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip color="success" label={`Ready: ${summary.ready}`} />
            <Chip color="warning" label={`Has balance: ${summary.has_balance} (MVR ${summary.has_balance_total})`} />
            <Chip color="error" label={`Effective package: ${summary.has_effective_package}`} />
            <Chip color="error" label={`Rented device: ${summary.has_rented_device}`} />
            <Chip label={`Already terminated: ${summary.already_terminated}`} />
            <Chip color="error" label={`Not found / mismatch: ${summary.not_found + summary.mismatch + summary.ambiguous}`} />
            <Chip variant="outlined" label={`Subscriptions to cancel: ${summary.services_to_cancel}`} />
          </Box>

          {summary.has_balance > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {summary.has_balance} account(s) still hold a balance totalling MVR {summary.has_balance_total}. Accounts
              with a balance are not terminated – they are excluded from this run.
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteForever />}
              disabled={eligibleCount === 0 || jobActive}
              onClick={() => setConfirmOpen(true)}
            >
              Terminate {eligibleCount} account(s)
            </Button>
            <Button
              variant="outlined"
              startIcon={<GetApp />}
              onClick={() => download(`preview/${preview.preview_id}/csv`, 'account-termination-preview.csv')}
            >
              Download full preview
            </Button>
          </Box>

          <TableContainer sx={{ maxHeight: 360 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Group', 'Account Number', 'Contact Code', 'Name', 'Account State', 'Balance', 'Subscriptions To Cancel', 'Status', 'Message'].map((h) => (
                    <TableCell key={h} sx={headerCellSx}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.rows.map((row) => {
                  const meta = STATUS_META[row.status] || { label: row.status, color: 'default' };
                  return (
                    <TableRow key={`${row.contact_code}-${row.account_number}`}>
                      <TableCell>{row.group}</TableCell>
                      <TableCell>{row.account_number}</TableCell>
                      <TableCell>{row.contact_code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.account_state || '-'}</TableCell>
                      <TableCell>{row.balance ?? '-'}</TableCell>
                      <TableCell>{row.services_to_cancel}</TableCell>
                      <TableCell><Chip size="small" label={meta.label} color={meta.color} /></TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>{row.message}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {preview.rows_truncated && (
            <Typography variant="caption" color="text.secondary">
              Showing the first {preview.rows.length} rows. Download the full preview for all {summary.total_rows}.
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ p: 2, backgroundColor: '#ffffff', borderRadius: 2, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Termination jobs (since last server restart)
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Job', 'File', 'Started', 'Started By', 'Status', 'Processed', 'Terminated', 'Skipped', 'Failed', ''].map((h) => (
                  <TableCell key={h} sx={headerCellSx}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} sx={{ color: '#64748b' }}>No termination jobs yet.</TableCell>
                </TableRow>
              ) : (
                jobs.map((j) => (
                  <TableRow key={j.job_id} hover>
                    <TableCell>{j.job_id}</TableCell>
                    <TableCell>{j.file_name}</TableCell>
                    <TableCell>{formatDateTime(j.started_at)}</TableCell>
                    <TableCell>{j.started_by}</TableCell>
                    <TableCell>{j.status}</TableCell>
                    <TableCell>{j.processed} / {j.total}</TableCell>
                    <TableCell>{j.terminated}</TableCell>
                    <TableCell>{j.skipped}</TableCell>
                    <TableCell>{j.failed}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<GetApp />}
                        onClick={() => download(`jobs/${j.job_id}/results.csv`, `account-termination-results-${j.job_id}.csv`)}
                      >
                        CSV
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Dialog open={confirmOpen} onClose={() => !isStarting && setConfirmOpen(false)}>
        <DialogTitle>Terminate {eligibleCount} account(s)?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            All remaining subscriptions on these accounts will be cancelled and the accounts will be terminated in
            CRM.COM. This cannot be undone from this tool. Accounts with a balance are not included.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label={`Type ${CONFIRM_WORD} to confirm`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={isStarting}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={confirmText !== CONFIRM_WORD || isStarting}
            onClick={handleStart}
          >
            {isStarting ? 'Starting...' : 'Terminate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulkAccountTermination;
