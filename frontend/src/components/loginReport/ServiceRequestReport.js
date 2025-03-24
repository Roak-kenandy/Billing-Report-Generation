import { useState, useEffect, useRef } from 'react';
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
  CircularProgress, // Added for loading spinner
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
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale'; // Import the English locale

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
    setIsDownloading(true); // Set loading state to true
    const url = new URL(`${API_URL}/getServicerequestReports`);
    url.searchParams.append('team', team);
    url.searchParams.append('queue', queue);
    if (startDate) {
      url.searchParams.append('startDate', format(startDate, 'yyyy-MM-dd'));
    }
    if (endDate) {
      url.searchParams.append('endDate', format(endDate, 'yyyy-MM-dd'));
    }

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
    setIsDownloading(false); // Reset loading state
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
  const [isLoading, setIsLoading] = useState(true);
  const [ownerTeamFilter, setOwnerTeamFilter] = useState('All');
  const [selectedOwnerTeamTab, setSelectedOwnerTeamTab] = useState(0);
  const [dateRange, setDateRange] = useState([
    {
      startDate: null,
      endDate: null,
      key: 'selection',
    },
  ]);
  const [tempDateRange, setTempDateRange] = useState([
    {
      startDate: null,
      endDate: null,
      key: 'selection',
    },
  ]);
  const [open, setOpen] = useState(false); // State for Dialog open/close
  const [isDownloading, setIsDownloading] = useState(false); // State for download loading

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleOwnerTeamTabChange = (event, newValue) => {
    setSelectedOwnerTeamTab(newValue);
  };

  const handleOwnerTeamChange = (event) => {
    setOwnerTeamFilter(event.target.value);
    setSelectedOwnerTeamTab(0);
  };

  const handleDateRangeClick = () => {
    setOpen(true); // Open the Dialog
    // Initialize tempDateRange with the current dateRange when opening the dialog
    setTempDateRange(dateRange);
  };

  const handleDateRangeClose = () => {
    setOpen(false); // Close the Dialog
  };

  const handleApply = () => {
    // Apply the temporary date range to the main state
    setDateRange(tempDateRange);
    setOpen(false); // Close the Dialog
  };

  const handleCancel = () => {
    // Close the dialog without applying changes
    setOpen(false); // Close the Dialog
  };

  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        const response = await fetch(`${API_URL}/getGraphData`);
        if (!response.ok) throw new Error('Failed to fetch graph data');
        const data = await response.json();
        setGraphData((prevData) => ({
          ...prevData,
          ...data.data,
        }));
      } catch (error) {
        console.error('Error fetching graph data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGraphData();
  }, []);

  useEffect(() => {
    const fetchQueueData = async () => {
      try {
        const url = new URL(`${API_URL}/getQueueData`);
        url.searchParams.append('owner_team', ownerTeamFilter);
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('Failed to fetch queue data');
        const data = await response.json();
        setQueueData(data.data);
      } catch (error) {
        console.error('Error fetching queue data:', error);
      }
    };

    if (tabValue === 1) {
      fetchQueueData();
    }
  }, [tabValue, ownerTeamFilter]);

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  const createGradient = (ctx, chartArea, startColor, endColor) => {
    const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    return gradient;
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
          if (!chartArea) return '#34C759';
          return createGradient(ctx, chartArea, '#34C759', '#FF3B30');
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
          if (!chartArea) return '#34C759';
          return createGradient(ctx, chartArea, '#34C759', '#FF3B30');
        },
        borderRadius: 8,
        borderSkipped: false,
        barThickness: 20,
      },
    ],
  };

  const installationPieData = {
    labels: ['Closed', 'Open'],
    datasets: [
      {
        data: [graphData.installationPie.Closed, graphData.installationPie.Open],
        backgroundColor: ['#34C759', '#36A2EB'],
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const faultPieData = {
    labels: ['Closed', 'Open'],
    datasets: [
      {
        data: [graphData.faultPie.Closed, graphData.faultPie.Open],
        backgroundColor: ['#34C759', '#36A2EB'],
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14, family: "'Inter', sans-serif" },
        bodyFont: { size: 12, family: "'Inter', sans-serif" },
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 12 },
          color: '#64748B',
        },
      },
      y: {
        grid: {
          color: '#E2E8F0',
          borderDash: [5, 5],
        },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 12 },
          color: '#64748B',
          beginAtZero: true,
        },
      },
    },
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { family: "'Inter', sans-serif", size: 12 },
          color: '#64748B',
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14, family: "'Inter', sans-serif" },
        bodyFont: { size: 12, family: "'Inter', sans-serif" },
        padding: 10,
        cornerRadius: 8,
      },
    },
    elements: {
      arc: {
        borderWidth: 0,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
      },
    },
  };

  const ownerTeams = ['All', ...new Set(queueData.queueTable.map((row) => row.ownerTeam))];
  const ownerTeamTabs = ownerTeams.filter((team) => team !== 'All');

  const groupedQueueData = ownerTeamTabs.map((team) => {
    const teamData = queueData.queueTable.filter((row) => row.ownerTeam === team);
    const summary = {
      installationTT: 0,
      installationTTClosed: 0,
      faultTT: 0,
      faultTTClosed: 0,
      relocationTT: 0,
      relocationTTClosed: 0,
      migrationTT: 0,
      migrationTTClosed: 0,
      totalTTClosed: 0,
      totalTTOpen: 0,
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
    <Container
      maxWidth="xl"
      sx={{
        background: '#f9fafb',
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          backgroundColor: '#1e3a8a',
          borderRadius: 2,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          mb: 3,
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="navigation tabs"
          sx={{
            '& .MuiTabs-indicator': { backgroundColor: '#3b82f6', height: 3 },
          }}
        >
          <Tab
            icon={<DashboardIcon />}
            label="Dashboard"
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
          <Tab
            icon={<ListIcon />}
            label="Queue"
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
          <Tab
            icon={<DescriptionIcon />}
            label="Reports"
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
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            backgroundColor: '#ffffff',
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <TabPanel value={tabValue} index={0}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1e3a8a', mb: 2 }}>
              Dashboard Overview
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 300, height: 300 }}>
                <Typography variant="h6" sx={{ fontFamily: "'Inter', sans-serif", color: '#1e3a8a' }}>
                  Installation Related Tickets - {graphData.year}
                </Typography>
                <Bar data={installationHistogramData} options={barChartOptions} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 300, height: 300 }}>
                <Typography variant="h6" sx={{ fontFamily: "'Inter', sans-serif", color: '#1e3a8a' }}>
                  Fault Related Tickets - {graphData.year}
                </Typography>
                <Bar data={faultHistogramData} options={barChartOptions} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 200, height: 300 }}>
                <Typography variant="h6" sx={{ fontFamily: "'Inter', sans-serif", color: '#1e3a8a' }}>
                  Installation TTs - {graphData.year}
                </Typography>
                <Pie data={installationPieData} options={pieChartOptions} />
                <Typography sx={{ mt: 1, fontFamily: "'Inter', sans-serif", color: '#64748B' }}>
                  # Open: {graphData.installationPie.Open}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 200, height: 300 }}>
                <Typography variant="h6" sx={{ fontFamily: "'Inter', sans-serif", color: '#1e3a8a' }}>
                  Fault TTs - {graphData.year}
                </Typography>
                <Pie data={faultPieData} options={pieChartOptions} />
                <Typography sx={{ mt: 1, fontFamily: "'Inter', sans-serif", color: '#64748B' }}>
                  # Open: {graphData.faultPie.Open}
                </Typography>
              </Box>
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1e3a8a', mb: 2 }}>
              Queues
            </Typography>
            <Typography sx={{ color: '#475569', mb: 2 }}>
              Note: Dashboard will update every 2 mins. Closed tickets shown in the table are 1 - Day closed ticket count during that day
            </Typography>

            <Box
              sx={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                backgroundColor: '#ffffff',
                pt: 2,
                pb: 2,
                borderBottom: '1px solid #E2E8F0',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button variant="contained" color="error">
                    Reset
                  </Button>
                  <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel>Select Category</InputLabel>
                    <Select
                      value={ownerTeamFilter}
                      onChange={handleOwnerTeamChange}
                      label="Select Category"
                    >
                      {ownerTeams.map((team) => (
                        <MenuItem key={team} value={team}>
                          {team}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button variant="contained" color="error">
                    Submit
                  </Button>
                </Box>
                <Typography sx={{ fontWeight: 600, color: '#1e3a8a' }}>
                  Total TT: {queueData.totalTickets}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
              <Card sx={{ boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: '#1e3a8a' }}>
                    Queue Summary by Team
                  </Typography>
                  {ownerTeamTabs.length > 0 ? (
                    <>
                      <Tabs
                        value={selectedOwnerTeamTab}
                        onChange={handleOwnerTeamTabChange}
                        sx={{ mb: 2 }}
                      >
                        {ownerTeamTabs.map((team, index) => (
                          <Tab
                            key={team}
                            label={team}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 500,
                              color: '#64748B',
                              '&.Mui-selected': { color: '#1e3a8a' },
                            }}
                          />
                        ))}
                      </Tabs>
                      {groupedQueueData[selectedOwnerTeamTab] && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                          <Box sx={{ flex: 1, minWidth: 200 }}>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Installation TT: {groupedQueueData[selectedOwnerTeamTab].installationTT}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Installation TT Closed: {groupedQueueData[selectedOwnerTeamTab].installationTTClosed}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 200 }}>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Fault TT: {groupedQueueData[selectedOwnerTeamTab].faultTT}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Fault TT Closed: {groupedQueueData[selectedOwnerTeamTab].faultTTClosed}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 200 }}>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Relocation TT: {groupedQueueData[selectedOwnerTeamTab].relocationTT}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Relocation TT Closed: {groupedQueueData[selectedOwnerTeamTab].relocationTTClosed}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 200 }}>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Migration TT: {groupedQueueData[selectedOwnerTeamTab].migrationTT}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Migration TT Closed: {groupedQueueData[selectedOwnerTeamTab].migrationTTClosed}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 200 }}>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Total TT Closed: {groupedQueueData[selectedOwnerTeamTab].totalTTClosed}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Total TT Open: {groupedQueueData[selectedOwnerTeamTab].totalTTOpen}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </>
                  ) : (
                    <Typography>No data available for the selected team.</Typography>
                  )}
                </CardContent>
              </Card>

              <Card sx={{ boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)' }}>
                <CardContent>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6" sx={{ color: '#1e3a8a' }}>
                        Ticket Aging - All Queues
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {queueData.openTicketsAging.map((row, index) => (
                          <Box key={index} sx={{ flex: 1, minWidth: 200 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
                              {row.agingBucket}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Ticket Count: {row.count}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Percentage: {row.percentage}%
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </CardContent>
              </Card>

              <Card sx={{ boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)' }}>
                <CardContent>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6" sx={{ color: '#1e3a8a' }}>
                        Closed Tickets - All Queues: {queueData.closedTicketsAging.reduce((sum, item) => sum + item.count, 0)}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {queueData.closedTicketsAging.map((row, index) => (
                          <Box key={index} sx={{ flex: 1, minWidth: 200 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
                              {row.agingBucket}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Ticket Count: {row.count}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748B' }}>
                              Percentage: {row.percentage}%
                            </Typography>
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
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1e3a8a', mb: 3 }}>
              Reporting Section
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1, color: '#1e3a8a', fontWeight: 500 }}>
                TIME FRAME
              </Typography>
              <TextField
                label="Select Date Range"
                value={
                  dateRange[0].startDate && dateRange[0].endDate
                    ? `${format(dateRange[0].startDate, 'dd-MM-yyyy')} - ${format(dateRange[0].endDate, 'dd-MM-yyyy')}`
                    : ''
                }
                onClick={handleDateRangeClick}
                sx={{ width: 300 }}
                InputProps={{
                  readOnly: true,
                }}
              />
              <Dialog
                open={open}
                onClose={handleDateRangeClose}
                maxWidth="md"
                fullWidth
              >
                <DialogContent>
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
                <DialogActions>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleApply}
                    disabled={!tempDateRange[0].startDate || !tempDateRange[0].endDate}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                </DialogActions>
              </Dialog>
            </Box>
            <Button
              onClick={() =>
                handleDownloadCSV(
                  'b0cc03f3-be1a-4087-8ef4-b404c404c934',
                  'd584630a-995f-4785-a31b-617bd65e8cd7',
                  dateRange[0].startDate,
                  dateRange[0].endDate,
                  setIsDownloading // Pass the setIsDownloading function
                )
              }
              variant="contained"
              size="large"
              startIcon={
                isDownloading ? (
                  <CircularProgress size={20} sx={{ color: '#ffffff' }} />
                ) : (
                  <GetAppIcon />
                )
              }
              disabled={!isDownloadEnabled || isDownloading} // Disable during download
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
                '&:hover': isDownloadEnabled && !isDownloading
                  ? {
                      backgroundColor: '#16a34a',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    }
                  : { backgroundColor: '#cccccc' },
                '&:disabled': {
                  backgroundColor: '#cccccc',
                  color: '#ffffff',
                  cursor: 'not-allowed',
                },
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