import React, { useState, useEffect } from 'react';
import {
    Paper,
    Box,
    useMediaQuery,
    Typography,
    Grid,
    useTheme,
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

const Dashboard = () => {
    const theme = useTheme();
    const [metrics, setMetrics] = useState({
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        totalRevenue: 0,
    });
    const [packageData, setPackageData] = useState([]);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const API_URL = 'http://localhost:3003/billing-reports';

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const metricsResponse = await fetch(`${API_URL}/metrics`);
                const metricsData = await metricsResponse.json();
                setMetrics(metricsData.data);

                const packageResponse = await fetch(`${API_URL}/package-distribution`);
                const packageDistribution = await packageResponse.json();
                setPackageData(packageDistribution.data);
            } catch (err) {
                console.error('Error initializing data:', err);
            }
        };
        fetchInitialData();
    }, []);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <Paper
                    sx={{
                        p: 1.5,
                        borderRadius: 2,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        bgcolor: '#ffffff',
                        border: '1px solid #e2e8f0',
                    }}
                >
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                        {payload[0].payload.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
                        Subscriptions: {payload[0].value}
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
                },
                {
                    title: 'Active Subscriptions',
                    value: metrics.activeSubscriptions,
                    color: '#22c55e',
                },
                {
                    title: 'Total Revenue',
                    value: `Rf ${metrics.totalRevenue.toLocaleString()}`,
                    color: '#f59e0b',
                },
            ].map((metric, index) => (
                <Grid item xs={12} md={4} key={index}>
                    <Paper
                        sx={{
                            p: 3,
                            borderRadius: 2,
                            backgroundColor: '#ffffff',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.1)',
                            },
                        }}
                    >
                        <Typography
                            variant="subtitle1"
                            sx={{ color: '#64748b', mb: 1, fontWeight: 500 }}
                        >
                            {metric.title}
                        </Typography>
                        <Typography
                            variant="h4"
                            sx={{ fontWeight: 700, color: metric.color }}
                        >
                            {metric.value}
                        </Typography>
                    </Paper>
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
                height: 450,
                transition: 'all 0.3s ease',
                '&:hover': {
                    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.1)',
                },
            }}
        >
            <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: '#1e3a8a', mb: 3 }}
            >
                Subscription Trends by Package
            </Typography>
            <ResponsiveContainer width="100%" height="85%">
                <LineChart data={packageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                        dataKey="name"
                        angle={isSmallScreen ? -60 : -45}
                        textAnchor="end"
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        interval={isSmallScreen ? 2 : 0}
                        height={60}
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
                        strokeWidth={2.5}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#1e3a8a' }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </Paper>
    );

    return (
        <Box
            sx={{
                p: isSmallScreen ? 2 : 4,
                backgroundColor: '#f9fafb',
                minHeight: 'calc(100vh - 37px)',
            }}
        >
            <Typography
                variant="h4"
                sx={{
                    fontWeight: 700,
                    color: '#1e3a8a',
                    mb: 4,
                    letterSpacing: '-0.5px',
                }}
            >
                Billing Dashboard
            </Typography>

            {renderMetricsCards()}
            {renderPackageChart()}
        </Box>
    );
};

export default Dashboard;