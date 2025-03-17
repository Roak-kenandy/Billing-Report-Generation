import React, { useState, useEffect } from 'react';
import {
    Paper,
    Box,
    useMediaQuery,
    Typography,
    Grid,
    useTheme
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

const Dashboard = () => {
    const theme = useTheme();
    const [metrics, setMetrics] = useState({
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        totalRevenue: 0
    });
    const [packageData, setPackageData] = useState([]);
    const isSmallScreen = useMediaQuery('(max-width:600px)');

    // Fetch initial data
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Fetch metrics
                const metricsResponse = await fetch('http://localhost:3003/billing-reports/metrics');
                const metricsData = await metricsResponse.json();
                setMetrics(metricsData.data);

                // Fetch package distribution
                const packageResponse = await fetch('http://localhost:3003/billing-reports/package-distribution');
                const packageDistribution = await packageResponse.json();
                setPackageData(packageDistribution.data);
            } catch (err) {
                console.error('Error initializing data:', err);
            }
        };
        fetchInitialData();
    }, []);

    // Custom tooltip component
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <Paper sx={{ 
                    p: 1.5, 
                    boxShadow: 3,
                    bgcolor: 'background.paper'
                }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {payload[0].payload.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Subscriptions: {payload[0].value}
                    </Typography>
                </Paper>
            );
        }
        return null;
    };

    const renderMetricsCards = () => (
        <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
                <Paper sx={{ 
                    p: 3, 
                    borderRadius: 2,
                    bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#f8f9fa',
                    boxShadow: '0px 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                        Total Subscriptions
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {metrics.totalSubscriptions}
                    </Typography>
                </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
                <Paper sx={{ 
                    p: 3, 
                    borderRadius: 2,
                    bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#f8f9fa',
                    boxShadow: '0px 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                        Active Subscriptions
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {metrics.activeSubscriptions}
                    </Typography>
                </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
                <Paper sx={{ 
                    p: 3, 
                    borderRadius: 2,
                    bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#f8f9fa',
                    boxShadow: '0px 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                        Total Revenue
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        ${metrics.totalRevenue.toLocaleString()}
                    </Typography>
                </Paper>
            </Grid>
        </Grid>
    );

    const renderPackageChart = () => (
        <Paper sx={{ 
            p: 3, 
            mb: 3, 
            height: 400,
            borderRadius: 2,
            bgcolor: 'background.paper',
            boxShadow: '0px 2px 8px rgba(0,0,0,0.1)'
        }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                Subscription Trends by Package
            </Typography>
            <ResponsiveContainer width="100%" height="85%">
                <LineChart data={packageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        tick={{ fill: theme.palette.text.secondary }}
                        interval={isSmallScreen ? 2 : 0}
                    />
                    <YAxis 
                        tick={{ fill: theme.palette.text.secondary }}
                        tickFormatter={(value) => new Intl.NumberFormat('en').format(value)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={theme.palette.primary.main}
                        strokeWidth={2}
                        dot={{ fill: theme.palette.primary.main, strokeWidth: 2 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </Paper>
    );

    return (
        <Box sx={{ p: isSmallScreen ? 2 : 3, padding: '10px' }}>
            <Typography variant="h4" gutterBottom sx={{ 
                fontWeight: 700, 
                mb: 4,
                color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary'
            }}>
                Billing Dashboard
            </Typography>

            {renderMetricsCards()}
            {renderPackageChart()}
        </Box>
    );
};

export default Dashboard;