import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Grid,
    Paper,
    Skeleton,
    useMediaQuery,
    Button,
    CircularProgress,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

const DeviceStatistics = () => {
    const [loading, setLoading] = useState(true);
    const [deviceStats, setDeviceStats] = useState([]);
    const [downloading, setDownloading] = useState(false); // State for download button
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    // const API_URL = 'http://localhost:3003/billing-reports';
    const API_URL = 'https://mdnrpt.medianet.mv/billing-reports';

    // Fetch device statistics for display
    const fetchDeviceStatistics = async () => {
        setLoading(true);
        try {
            const url = `${API_URL}/devices/statistics`;
            const response = await fetch(url);
            if (!response.ok) throw Error(response.status);
            const data = await response.json();
            const stats = data.statistics || [];
            console.log('Fetched device statistics:', data);
            setDeviceStats(stats);
        } catch (err) {
            console.error('Error fetching device statistics:', err);
        } finally {
            setLoading(false);
        }
    };

    // Handle CSV download
    const handleDownloadCSV = async () => {
        setDownloading(true);
        try {
            const url = `${API_URL}/devices/statistics/export`;
            const response = await fetch(url);
            console.log('Download URL:', url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to download CSV: ${response.status} - ${errorText}`);
            }
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = 'device_statistics.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error('Error downloading CSV:', err);
            alert('Failed to download CSV. Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    useEffect(() => {
        fetchDeviceStatistics();
    }, []);

    return (
        <Box
            sx={{
                p: 4,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 'calc(100vh - 37px)',
                background: 'linear-gradient(135deg, #e0e7ff 0%, #f9fafb 100%)',
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 4,
                }}
            >
                <Typography
                    variant="h3"
                    sx={{
                        fontWeight: 700,
                        color: '#1e3a8a',
                        textAlign: isSmallScreen ? 'center' : 'left',
                        letterSpacing: '-0.5px',
                        background: 'linear-gradient(to right, #1e3a8a, #3b82f6)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'fadeIn 1s ease-in-out',
                    }}
                >
                    Device Statistics
                </Typography>
                <Button
                    variant="contained"
                    startIcon={downloading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
                    onClick={handleDownloadCSV}
                    disabled={downloading}
                    sx={{
                        backgroundColor: '#3b82f6',
                        color: '#fff',
                        borderRadius: 2,
                        px: 3,
                        py: 1,
                        fontWeight: 600,
                        '&:hover': {
                            backgroundColor: '#2563eb',
                        },
                        '&:disabled': {
                            backgroundColor: '#93c5fd',
                            color: '#fff',
                        },
                    }}
                >
                    {downloading ? 'Downloading...' : 'Download CSV'}
                </Button>
            </Box>

            <Box
                sx={{
                    flex: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: 3,
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)',
                    p: 3,
                    maxHeight: 'calc(100vh - 200px)',
                }}
            >
                <Grid container spacing={3} justifyContent="center">
                    {loading ? (
                        Array.from({ length: 2 }).map((_, index) => (
                            <Grid item xs={12} sm={6} key={index}>
                                <Paper
                                    sx={{
                                        p: 3,
                                        borderRadius: 3,
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                        background: 'linear-gradient(145deg, #ffffff, #f1f5f9)',
                                    }}
                                >
                                    <Skeleton variant="text" width="50%" height={50} />
                                    <Skeleton variant="text" width="70%" />
                                </Paper>
                            </Grid>
                        ))
                    ) : deviceStats.length === 0 ? (
                        <Box sx={{ width: '100%', textAlign: 'center', py: 6 }}>
                            <Typography
                                variant="h6"
                                sx={{
                                    color: '#64748b',
                                    fontWeight: 500,
                                    animation: 'fadeIn 1s ease-in-out',
                                }}
                            >
                                No data available
                            </Typography>
                        </Box>
                    ) : (
                        deviceStats.map((stat, index) => (
                            <Grid item xs={12} sm={6} key={index}>
                                <Paper
                                    sx={{
                                        p: 3,
                                        borderRadius: 3,
                                        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)',
                                        borderLeft: `5px solid ${
                                            stat.tag === 'Medianet TV' ? '#22c55e' : '#3b82f6'
                                        }`,
                                        background: 'linear-gradient(145deg, #ffffff, #f1f5f9)',
                                        transition: 'transform 0.4s ease, box-shadow 0.4s ease',
                                        '&:hover': {
                                            transform: 'scale(1.05) translateY(-5px)',
                                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                                        },
                                        position: 'relative',
                                        overflow: 'hidden',
                                        '&::before': {
                                            content: '""',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            background: `radial-gradient(circle at top left, ${
                                                stat.tag === 'Medianet TV'
                                                    ? 'rgba(34, 197, 94, 0.1)'
                                                    : 'rgba(59, 130, 246, 0.1)'
                                            }, transparent)`,
                                            zIndex: 0,
                                        },
                                    }}
                                >
                                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                                        <Typography
                                            variant="h3"
                                            sx={{
                                                color: stat.tag === 'Medianet TV' ? '#22c55e' : '#3b82f6',
                                                fontWeight: 700,
                                                mb: 2,
                                                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                                animation: 'slideIn 0.5s ease-in-out',
                                            }}
                                        >
                                            {stat.totalDevices.toLocaleString()}
                                        </Typography>
                                        <Typography
                                            variant="h6"
                                            sx={{
                                                color: '#1e3a8a',
                                                fontWeight: 600,
                                                letterSpacing: '0.5px',
                                            }}
                                        >
                                            {stat.tag || 'N/A'}
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                        ))
                    )}
                </Grid>
            </Box>

            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(-20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </Box>
    );
};

export default DeviceStatistics;