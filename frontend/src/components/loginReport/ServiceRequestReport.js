import { useState, useEffect } from 'react';
import {
  Button,
  Tabs,
  Tab,
  Container,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Dialog,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  List as ListIcon,
  Description as DescriptionIcon,
  GetApp as GetAppIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const API_URL = 'http://localhost:3003/billing-reports';

const handleDownloadCSV = async (team, queue, startDate, endDate, setIsDownloading) => {
  try {
    setIsDownloading(true);
    const url = new URL(`${API_URL}/getServicerequestReports`);
    url.searchParams.append('team', team);
    url.searchParams.append('queue', queue);
    if (startDate) url.searchParams.append('startDate', format(startDate, 'yyyy-MM-dd'));
    if (endDate) url.searchParams.append('endDate', format(endDate, 'yyyy-MM-dd'));

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Export failed');

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', 'service-request-reports.csv');
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

const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`simple-tabpanel-${index}`}
    aria-labelledby={`simple-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const ServiceRequestReport = () => {
  const [tabValue, setTabValue] = useState(0);
  const [graphData, setGraphData] = useState({
    year: new Date().getFullYear(),
    installationHistogram: [],
    faultHistogram: [],
    installationPie: { Closed: 0, Open: 0 },
    faultPie: { Closed: 0, Open: 0 },
  });
  const [queueData, setQueueData] = useState({
    queueTable: [],
    openTicketsAging: [],
    closedTicketsAging: [],
    totalTickets: 0,
  });
  const [initialQueueData, setInitialQueueData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [ownerTeamFilter, setOwnerTeamFilter] = useState('All');
  const [selectedOwnerTeamTab, setSelectedOwnerTeamTab] = useState(0);
  const [dateRange, setDateRange] = useState([{ startDate: null, endDate: null, key: 'selection' }]);
  const [tempDateRange, setTempDateRange] = useState([{ startDate: null, endDate: null, key: 'selection' }]);
  const [open, setOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleTabChange = (event, newValue) => setTabValue(newValue);
  const handleOwnerTeamTabChange = (event, newValue) => setSelectedOwnerTeamTab(newValue);
  const handleOwnerTeamChange = (event) => {
    setOwnerTeamFilter(event.target.value);
    setSelectedOwnerTeamTab(0);
  };
  const handleDateRangeClick = () => {
    setOpen(true);
    setTempDateRange(dateRange);
  };
  const handleDateRangeClose = () => setOpen(false);
  const handleApply = () => {
    setDateRange(tempDateRange);
    setOpen(false);
  };
  const handleCancel = () => setOpen(false);

  const handleSubmit = async () => {
    setIsQueueLoading(true);
    try {
      const url = new URL(`${API_URL}/getQueueData`);
      url.searchParams.append('owner_team', ownerTeamFilter);
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch queue data');
      const data = await response.json();
      setQueueData(data.data);
    } catch (error) {
      console.error('Error fetching queue data:', error);
    } finally {
      setIsQueueLoading(false);
    }
  };

  const handleReset = () => {
    setOwnerTeamFilter('All');
    setSelectedOwnerTeamTab(0);
    if (initialQueueData) setQueueData(initialQueueData);
  };

  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        const response = await fetch(`${API_URL}/getGraphData`);
        if (!response.ok) throw new Error('Failed to fetch graph data');
        const data = await response.json();
        setGraphData((prevData) => ({ ...prevData, ...data.data }));
      } catch (error) {
        console.error('Error fetching graph data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGraphData();
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsQueueLoading(true);
        const url = new URL(`${API_URL}/getQueueData`);
        url.searchParams.append('owner_team', 'All');
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('Failed to fetch queue data');
        const data = await response.json();
        setQueueData(data.data);
        setInitialQueueData(data.data);
      } catch (error) {
        console.error('Error fetching initial queue data:', error);
      } finally {
        setIsQueueLoading(false);
      }
    };
    if (tabValue === 1 && !initialQueueData) fetchInitialData();
  }, [tabValue]);

  if (isLoading) return <Typography>Loading...</Typography>;

  const createGradient = (ctx, chartArea, startColor, endColor) => {
    const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    return gradient;
  };

  const chartCommonStyles = {
    borderRadius: 2,
    padding: 2,
    backgroundColor: '#f8fafc',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  };

  const installationHistogramData = {
    labels: graphData.installationHistogram?.map((item) => item.bucket) || [],
    datasets: [
      {
        label: 'Closed',
        data: graphData.installationHistogram?.map((item) => item.Closed) || [],
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          return !chartArea ? '#34C759' : createGradient(ctx, chartArea, '#34C759', '#FF3B30');
        },
        borderRadius: 8,
        borderSkipped: false,
        barThickness: 20,
      },
    ],
  };

  const faultHistogramData = {
    labels: graphData.faultHistogram?.map((item) => item.bucket) || [],
    datasets: [
      {
        label: 'Closed',
        data: graphData.faultHistogram?.map((item) => item.Closed) || [],
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          return !chartArea ? '#34C759' : createGradient(ctx, chartArea, '#34C759', '#FF3B30');
        },
        borderRadius: 8,
        borderSkipped: false,
        barThickness: 20,
      },
    ],
  };

  const installationPieData = {
    labels: ['Closed', 'Open'],
    datasets: [{ data: [graphData.installationPie.Closed, graphData.installationPie.Open], backgroundColor: ['#34C759', '#36A2EB'], borderWidth: 0, hoverOffset: 10 }],
  };

  const faultPieData = {
    labels: ['Closed', 'Open'],
    datasets: [{ data: [graphData.faultPie.Closed, graphData.faultPie.Open], backgroundColor: ['#34C759', '#36A2EB'], borderWidth: 0, hoverOffset: 10 }],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleFont: { size: 14, family: "'Inter', sans-serif" }, bodyFont: { size: 12, family: "'Inter', sans-serif" }, padding: 10, cornerRadius: 8 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: "'Inter', sans-serif", size: 12 }, color: '#64748B' } },
      y: { grid: { color: '#E2E8F0', borderDash: [5, 5] }, ticks: { font: { family: "'Inter', sans-serif", size: 12 }, color: '#64748B', beginAtZero: true } },
    },
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { family: "'Inter', sans-serif", size: 12 }, color: '#64748B', padding: 20 } },
      tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleFont: { size: 14, family: "'Inter', sans-serif" }, bodyFont: { size: 12, family: "'Inter', sans-serif" }, padding: 10, cornerRadius: 8 },
    },
    elements: { arc: { borderWidth: 0, shadowOffsetX: 2, shadowOffsetY: 2, shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.1)' } },
  };

  const ownerTeams = ['All', ...new Set(queueData.queueTable.map((row) => row.ownerTeam))];
  const ownerTeamTabs = ownerTeams.filter((team) => team !== 'All');

  const groupedQueueData = ownerTeamTabs.map((team) => {
    const teamData = queueData.queueTable.filter((row) => row.ownerTeam === team);
    const summary = {
      installationTT: 0, installationTTClosed: 0, faultTT: 0, faultTTClosed: 0,
      relocationTT: 0, relocationTTClosed: 0, migrationTT: 0, migrationTTClosed: 0,
      totalTTClosed: 0, totalTTOpen: 0,
    };

    teamData.forEach((row) => {
      if (row.queueName === 'Installation TT') {
        summary.installationTT = row.totalTickets;
        summary.installationTTClosed = row.closedTickets;
      } else if (row.queueName === 'Fault TT') {
        summary.faultTT = row.totalTickets;
        summary.faultTTClosed = row.closedTickets;
      } else if (row.queueName === 'Relocation TT') {
        summary.relocationTT = row.totalTickets;
        summary.relocationTTClosed = row.closedTickets;
      } else if (row.queueName === 'Migration TT') {
        summary.migrationTT = row.totalTickets;
        summary.migrationTTClosed = row.closedTickets;
      }
      summary.totalTTClosed += row.closedTickets;
      summary.totalTTOpen += row.openTickets;
    });

    return { ownerTeam: team, ...summary };
  });

  const isDownloadEnabled = dateRange[0].startDate && dateRange[0].endDate;

  return (
    <Container maxWidth="xl" sx={{ background: '#f9fafb', minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ backgroundColor: '#1e3a8a', borderRadius: 2, boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', position: 'sticky', top: 0, zIndex: 1000, mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="navigation tabs" sx={{ '& .MuiTabs-indicator': { backgroundColor: '#3b82f6', height: 3 } }}>
          {[
            { icon: <DashboardIcon />, label: 'Dashboard' },
            { icon: <ListIcon />, label: 'Queue' },
            { icon: <DescriptionIcon />, label: 'Reports' },
          ].map((tab, index) => (
            <Tab
              key={index}
              icon={tab.icon}
              label={tab.label}
              sx={{
                color: '#e0e7ff',
                fontWeight: 500,
                textTransform: 'none',
                px: 3,
                py: 2,
                '&.Mui-selected': { color: '#3b82f6' },
                transition: 'all 0.3s ease',
                '&:hover': { color: '#93c5fd' },
              }}
            />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 2, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', backgroundColor: '#ffffff', minHeight: '60vh', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TabPanel value={tabValue} index={0}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1e3a8a', mb: 3, borderBottom: '2px solid #eff6ff', pb: 1 }}>
              Dashboard Overview
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
              {[
                { title: `Installation Related Tickets - ${graphData.year}`, data: installationHistogramData, type: 'Bar' },
                { title: `Fault Related Tickets - ${graphData.year}`, data: faultHistogramData, type: 'Bar' },
                { title: `Installation TTs - ${graphData.year}`, data: installationPieData, type: 'Pie', open: graphData.installationPie.Open },
                { title: `Fault TTs - ${graphData.year}`, data: faultPieData, type: 'Pie', open: graphData.faultPie.Open },
              ].map((chart, index) => (
                <Card key={index} sx={{ ...chartCommonStyles, height: 350, display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Typography variant="h6" sx={{ color: '#1e3a8a', fontWeight: 500, mb: 2 }}>
                      {chart.title}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }}>
                      {chart.type === 'Bar' ? (
                        <Bar data={chart.data} options={barChartOptions} />
                      ) : (
                        <Pie data={chart.data} options={pieChartOptions} />
                      )}
                    </Box>
                    {chart.open !== undefined && (
                      <Typography sx={{ mt: 2, color: '#64748B', fontSize: '0.9rem', textAlign: 'center' }}>
                        Open Tickets: <span style={{ color: '#36A2EB', fontWeight: 600 }}>{chart.open}</span>
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
  <Typography variant="h4" sx={{ fontWeight: 600, color: '#1e3a8a', mb: 2, borderBottom: '2px solid #eff6ff', pb: 1 }}>
    Queue Management
  </Typography>
  {/* <Typography sx={{ color: '#475569', mb: 3, fontStyle: 'italic', fontSize: '0.9rem' }}>
    Dashboard updates every 2 minutes. Closed tickets reflect daily counts.
  </Typography> */}

  <Box sx={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#ffffff', pt: 2, pb: 2, borderBottom: '1px solid #E2E8F0', borderRadius: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel sx={{ color: '#1e3a8a' }}>Select Team</InputLabel>
          <Select value={ownerTeamFilter} onChange={handleOwnerTeamChange} label="Select Team" disabled={isQueueLoading} sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' } }}>
            {ownerTeams.map((team) => (
              <MenuItem key={team} value={team}>{team}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isQueueLoading}
          startIcon={isQueueLoading ? <CircularProgress size={20} /> : null}
          sx={{ backgroundColor: '#3b82f6', '&:hover': { backgroundColor: '#2563eb' }, textTransform: 'none', fontWeight: 500, px: 3 }}
        >
          {isQueueLoading ? 'Loading...' : 'Submit'}
        </Button>
        <Button
          variant="outlined"
          onClick={handleReset}
          disabled={isQueueLoading || ownerTeamFilter === 'All'}
          sx={{ borderColor: '#ef4444', color: '#ef4444', '&:hover': { borderColor: '#dc2626', color: '#dc2626' }, textTransform: 'none', fontWeight: 500, px: 3 }}
        >
          Reset
        </Button>
      </Box>
      <Typography sx={{ fontWeight: 600, color: '#1e3a8a', backgroundColor: '#eff6ff', px: 2, py: 1, borderRadius: 1 }}>
        Total Tickets: {queueData.totalTickets}
      </Typography>
    </Box>
  </Box>

  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 3 }}>
    <Card sx={{ boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 3, color: '#1e3a8a', fontWeight: 600 }}>
          Queue Summary by Team
        </Typography>
        {isQueueLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : ownerTeamTabs.length > 0 ? (
          <>
            {/* Add Previous and Next buttons for scrolling through tabs */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Tabs
                value={selectedOwnerTeamTab}
                onChange={handleOwnerTeamTabChange}
                sx={{ flex: 1, mx: 2, '& .MuiTabs-indicator': { backgroundColor: '#3b82f6' } }}
                variant="scrollable"
                scrollButtons="auto"
              >
                {ownerTeamTabs.map((team, index) => (
                  <Tab
                    key={team}
                    label={team}
                    sx={{ textTransform: 'none', fontWeight: 500, color: '#64748B', '&.Mui-selected': { color: '#1e3a8a' }, px: 3 }}
                  />
                ))}
              </Tabs>
            </Box>
            {groupedQueueData[selectedOwnerTeamTab] && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, p: 2, backgroundColor: '#f8fafc', borderRadius: 1 }}>
                {[
                  { label: 'Installation TT', total: groupedQueueData[selectedOwnerTeamTab].installationTT, closed: groupedQueueData[selectedOwnerTeamTab].installationTTClosed },
                  { label: 'Fault TT', total: groupedQueueData[selectedOwnerTeamTab].faultTT, closed: groupedQueueData[selectedOwnerTeamTab].faultTTClosed },
                  { label: 'Relocation TT', total: groupedQueueData[selectedOwnerTeamTab].relocationTT, closed: groupedQueueData[selectedOwnerTeamTab].relocationTTClosed },
                  { label: 'Migration TT', total: groupedQueueData[selectedOwnerTeamTab].migrationTT, closed: groupedQueueData[selectedOwnerTeamTab].migrationTTClosed },
                  { label: 'Overall', total: groupedQueueData[selectedOwnerTeamTab].totalTTOpen, closed: groupedQueueData[selectedOwnerTeamTab].totalTTClosed, totalLabel: 'Open' },
                ].map((item, index) => (
                  <Box key={index}>
                    <Typography variant="subtitle2" sx={{ color: '#64748B', fontWeight: 500 }}>{item.label}</Typography>
                    <Typography variant="body1" sx={{ color: '#1e3a8a' }}>{item.totalLabel || 'Total'}: {item.total}</Typography>
                    <Typography variant="body2" sx={{ color: '#34C759' }}>Closed: {item.closed}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </>
        ) : (
          <Typography sx={{ py: 2, color: '#64748B' }}>No data available for the selected team.</Typography>
        )}
      </CardContent>
    </Card>

    {/* Rest of the Queue Management tab (Ticket Aging sections) remains unchanged */}
    <Card sx={{ boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', borderRadius: 2 }}>
      <CardContent>
        <Accordion sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#1e3a8a' }} />} sx={{ backgroundColor: '#eff6ff', borderRadius: 1, mb: 1 }}>
            <Typography variant="h6" sx={{ color: '#1e3a8a', fontWeight: 600 }}>Ticket Aging - All Queues</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
              {queueData.openTicketsAging.map((row, index) => (
                <Box key={index} sx={{ p: 2, backgroundColor: '#ffffff', borderRadius: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <Typography variant="subtitle2" sx={{ color: '#1e3a8a', fontWeight: 600, mb: 1 }}>{row.agingBucket}</Typography>
                  <Typography variant="body2" sx={{ color: '#64748B' }}>Tickets: <span style={{ color: '#36A2EB', fontWeight: 500 }}>{row.count}</span></Typography>
                  <Typography variant="body2" sx={{ color: '#64748B' }}>Percentage: <span style={{ color: '#36A2EB', fontWeight: 500 }}>{row.percentage}%</span></Typography>
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>

    <Card sx={{ boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', borderRadius: 2 }}>
      <CardContent>
        <Accordion sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#1e3a8a' }} />} sx={{ backgroundColor: '#eff6ff', borderRadius: 1, mb: 1 }}>
            <Typography variant="h6" sx={{ color: '#1e3a8a', fontWeight: 600 }}>
              Closed Tickets - All Queues: {queueData.closedTicketsAging.reduce((sum, item) => sum + item.count, 0)}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
              {queueData.closedTicketsAging.map((row, index) => (
                <Box key={index} sx={{ p: 2, backgroundColor: '#ffffff', borderRadius: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <Typography variant="subtitle2" sx={{ color: '#1e3a8a', fontWeight: 600, mb: 1 }}>{row.agingBucket}</Typography>
                  <Typography variant="body2" sx={{ color: '#64748B' }}>Tickets: <span style={{ color: '#34C759', fontWeight: 500 }}>{row.count}</span></Typography>
                  <Typography variant="body2" sx={{ color: '#64748B' }}>Percentage: <span style={{ color: '#34C759', fontWeight: 500 }}>{row.percentage}%</span></Typography>
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  </Box>
</TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1e3a8a', mb: 3, borderBottom: '2px solid #eff6ff', pb: 1 }}>
              Reporting Section
            </Typography>
            <Box sx={{ mb: 4, p: 2, backgroundColor: '#f8fafc', borderRadius: 1 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, color: '#1e3a8a', fontWeight: 500 }}>Select Time Frame</Typography>
              <TextField
                label="Date Range"
                value={dateRange[0].startDate && dateRange[0].endDate ? `${format(dateRange[0].startDate, 'dd-MM-yyyy')} - ${format(dateRange[0].endDate, 'dd-MM-yyyy')}` : ''}
                onClick={handleDateRangeClick}
                sx={{ width: 300, '& .MuiOutlinedInput-root': { borderRadius: 1, backgroundColor: '#ffffff' } }}
                InputProps={{ readOnly: true }}
              />
              <Dialog open={open} onClose={handleDateRangeClose} maxWidth="md" fullWidth>
                <DialogContent sx={{ p: 3 }}>
                  <DateRange
                    editableDateInputs={true}
                    onChange={(item) => setTempDateRange([item.selection])}
                    moveRangeOnFirstSelection={false}
                    ranges={tempDateRange}
                    months={2}
                    direction="horizontal"
                    locale={enUS}
                  />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleApply}
                    disabled={!tempDateRange[0].startDate || !tempDateRange[0].endDate}
                    sx={{ backgroundColor: '#3b82f6', '&:hover': { backgroundColor: '#2563eb' }, textTransform: 'none', px: 3 }}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleCancel}
                    sx={{ borderColor: '#64748B', color: '#64748B', '&:hover': { borderColor: '#475569' }, textTransform: 'none', px: 3 }}
                  >
                    Cancel
                  </Button>
                </DialogActions>
              </Dialog>
            </Box>
            <Button
              onClick={() => handleDownloadCSV('b0cc03f3-be1a-4087-8ef4-b404c404c934', 'd584630a-995f-4785-a31b-617bd65e8cd7', dateRange[0].startDate, dateRange[0].endDate, setIsDownloading)}
              variant="contained"
              size="large"
              startIcon={isDownloading ? <CircularProgress size={20} sx={{ color: '#ffffff' }} /> : <GetAppIcon />}
              disabled={!isDownloadEnabled || isDownloading}
              sx={{
                backgroundColor: isDownloadEnabled && !isDownloading ? '#22c55e' : '#cccccc',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '1rem',
                textTransform: 'none',
                py: 1.5,
                px: 4,
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': isDownloadEnabled && !isDownloading ? { backgroundColor: '#16a34a', transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' } : { backgroundColor: '#cccccc' },
                '&:disabled': { backgroundColor: '#cccccc', color: '#ffffff', cursor: 'not-allowed' },
              }}
            >
              {isDownloading ? 'Downloading...' : 'Download Service Request Aging Report (CSV)'}
            </Button>
          </TabPanel>
        </Paper>
      </Box>
    </Container>
  );
};

export default ServiceRequestReport;