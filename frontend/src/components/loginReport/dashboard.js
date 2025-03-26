import React, { useState, useEffect } from 'react';
import {
    Paper,
    Box,
    useMediaQuery,
    Typography,
    Grid,
    useTheme,
    CircularProgress,
    Alert,
    Button,
    Card,
    CardContent,
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { Refresh } from '@mui/icons-material';

const Dashboard = () => {
    const theme = useTheme();
    const [metrics, setMetrics] = useState({
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        totalRevenue: 0,
    });
    const [packageData, setPackageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    // const API_URL = 'http://localhost:3003/billing-reports';
    const API_URL = `https://mdnrpt.medianet.mv/billing-reports`;

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [metricsResponse, packageResponse] = await Promise.all([
                fetch(`${API_URL}/metrics`),
                fetch(`${API_URL}/package-distribution`)
            ]);

            if (!metricsResponse.ok || !packageResponse.ok) {
                throw new Error('Failed to fetch dashboard data');
            }

            const metricsData = await metricsResponse.json();
            const packageDistribution = await packageResponse.json();

            setMetrics(metricsData.data);
            setPackageData(packageDistribution.data);
        } catch (err) {
            console.error('Error initializing data:', err);
            setError('Failed to load dashboard data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <Paper
                    sx={{
                        p: 1.5,
                        borderRadius: 2,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        bgcolor: '#ffffff',
                        border: '1px solid #e2e8f0',
                    }}
                >
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                        {payload[0].payload.name}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
                        Subscriptions: {payload[0].value.toLocaleString()}
                    </Typography>
                </Paper>
            );
        }
        return null;
    };

    const renderMetricsCards = () => (
        <Grid container spacing={3} sx={{ mb: 4 }}>
            {[
                {
                    title: 'Total Subscriptions',
                    value: metrics.totalSubscriptions,
                    color: '#3b82f6',
                    description: 'All registered subscriptions',
                },
                {
                    title: 'Active Subscriptions',
                    value: metrics.activeSubscriptions,
                    color: '#22c55e',
                    description: 'Currently active subscriptions',
                },
                {
                    title: 'Total Revenue',
                    value: `Rf ${metrics.totalRevenue.toLocaleString()}`,
                    color: '#f59e0b',
                    description: 'Total revenue generated',
                },
            ].map((metric, index) => (
                <Grid item xs={12} md={4} key={index}>
                    <Card
                        sx={{
                            p: 3,
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
                            },
                            opacity: loading ? 0.7 : 1,
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        <CardContent sx={{ p: 0 }}>
                            <Typography
                                variant="subtitle1"
                                sx={{ color: '#64748b', mb: 1, fontWeight: 500 }}
                            >
                                {metric.title}
                            </Typography>
                            {loading ? (
                                <CircularProgress size={24} sx={{ color: metric.color }} />
                            ) : (
                                <Typography
                                    variant="h4"
                                    sx={{ fontWeight: 700, color: metric.color, mb: 1 }}
                                >
                                    {metric.value}
                                </Typography>
                            )}
                            <Typography
                                variant="body2"
                                sx={{ color: '#94a3b8', fontSize: '0.85rem' }}
                            >
                                {metric.description}
                            </Typography>
                        </CardContent>
                        <Box
                            sx={{
                                position: 'absolute',
                                top: -20,
                                right: -20,
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                backgroundColor: `${metric.color}20`,
                                opacity: 0.2,
                            }}
                        />
                    </Card>
                </Grid>
            ))}
        </Grid>
    );

    const renderPackageChart = () => (
        <Paper
            sx={{
                p: 3,
                borderRadius: 2,
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                height: 500,
                transition: 'all 0.3s ease',
                '&:hover': {
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
                },
                position: 'relative',
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, color: '#1e3a8a' }}
                >
                    Subscription Trends by Package
                </Typography>
                <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={fetchInitialData}
                    disabled={loading}
                    sx={{
                        textTransform: 'none',
                        borderColor: '#3b82f6',
                        color: '#3b82f6',
                        '&:hover': {
                            borderColor: '#2563eb',
                            backgroundColor: '#f0f7ff',
                        },
                    }}
                >
                    Refresh
                </Button>
            </Box>
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '85%' }}>
                    <CircularProgress size={40} sx={{ color: '#3b82f6' }} />
                </Box>
            ) : error ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="error">{error}</Typography>
                    <Button
                        variant="contained"
                        onClick={fetchInitialData}
                        sx={{ mt: 2, backgroundColor: '#3b82f6' }}
                    >
                        Retry
                    </Button>
                </Box>
            ) : (
                <ResponsiveContainer width="100%" height="85%">
                    <LineChart data={packageData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                            dataKey="name"
                            angle={isSmallScreen ? -60 : -45}
                            textAnchor="end"
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            interval={isSmallScreen ? 1 : 0}
                            height={80}
                            padding={{ left: 20, right: 20 }}
                        />
                        <YAxis
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            tickFormatter={(value) => new Intl.NumberFormat('en').format(value)}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                            activeDot={{ r: 8, fill: '#1e3a8a', stroke: '#ffffff', strokeWidth: 2 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </Paper>
    );

    return (
        <Box
            sx={{
                p: isSmallScreen ? 2 : 4,
                backgroundColor: '#f9fafb',
                minHeight: 'calc(100vh - 37px)',
                // overflow: 'auto',
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 700,
                        color: '#1e3a8a',
                        letterSpacing: '-0.5px',
                    }}
                >
                    Billing Dashboard
                </Typography>
                <Typography
                    variant="body2"
                    sx={{ color: '#64748b', fontStyle: 'italic' }}
                >
                    Last updated: {loading ? 'Loading...' : new Date().toLocaleTimeString()}
                </Typography>
            </Box>

            {error && !loading && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {renderMetricsCards()}
            {renderPackageChart()}
        </Box>
    );
};

export default Dashboard;