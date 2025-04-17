import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Typography,
    Grid,
    Paper,
    Skeleton,
    useMediaQuery,
    Pagination,
    TextField,
} from '@mui/material';
import { GetApp } from '@mui/icons-material';
import SearchIcon from '@mui/icons-material/Search';

const ReferralCountReports = () => {
    const [loading, setLoading] = useState(true);
    const [registeredCounts, setRegisteredCounts] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    // const API_URL = 'http://localhost:3003/billing-reports';
    const API_URL = 'https://mdnrpt.medianet.mv/billing-reports';

    const fetchRegisteredCounts = async (page, limit, search = '') => {
        setLoading(true);
        try {
            let url = `${API_URL}/mtv/registered/count?page=${page}&limit=${limit}`;
            if (search) {
                url += `&search=${encodeURIComponent(search)}`;
            }
            const response = await fetch(url);
            const data = await response.json();
            const counts = data.data || [];
            console.log('Fetched registered counts:', data);
            setRegisteredCounts(counts);
            setPagination({
                page: data.pagination?.page || page,
                limit: data.pagination?.limit || limit,
                total: data.pagination?.total || counts.length,
                totalPages: data.pagination?.totalPages || Math.ceil(counts.length / limit),
            });
        } catch (err) {
            console.error('Error fetching registered counts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegisteredCounts(pagination.page, pagination.limit, searchTerm);
    }, [pagination.page, pagination.limit, searchTerm]);

    const handlePageChange = (event, value) => {
        setPagination({ ...pagination, page: value });
    };

    const handleDownloadCSV = async () => {
        try {
            setIsDownloading(true);
            let url = new URL(`${API_URL}/mtv/registered/count`, window.location.origin);
            if (searchTerm) {
                url.searchParams.append('search', searchTerm);
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('Export failed');

            const data = await response.json();

            const headers = ['Referral Code', 'Referral Type', 'Referral Count'];
            const csvRows = [
                headers.join(','),
                ...data.data.map((row) =>
                    [
                        `"${row['Referral Code'] || ''}"`,
                        `"${row['Referral Type'] || ''}"`,
                        row['Referral Count'],
                    ].join(',')
                ),
            ];
            const csvContent = csvRows.join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const downloadUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', 'referral-counts.csv');
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

    return (
        <Box
            sx={{
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 'calc(100vh - 37px)',
                background: '#f9fafb',
            }}
        >
            <Typography
                variant="h4"
                sx={{
                    mb: 2,
                    fontWeight: 600,
                    color: '#1e3a8a',
                    textAlign: isSmallScreen ? 'center' : 'left',
                }}
            >
                Referral Count Reports
            </Typography>

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
                }}
            >
                <TextField
                    label="Search by Code or Type"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: <SearchIcon sx={{ color: '#64748b', mr: 1 }} />,
                    }}
                    sx={{
                        width: isSmallScreen ? '100%' : 300,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: '#f1f5f9',
                        },
                        '& .MuiInputLabel-root': {
                            color: '#64748b',
                        },
                    }}
                />
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

            <Box
                sx={{
                    flex: 1,
                    overflowY: 'auto',
                    backgroundColor: '#ffffff',
                    borderRadius: 2,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    p: 2,
                    maxHeight: 'calc(100vh - 250px)',
                    '&::-webkit-scrollbar': {
                        width: 6,
                    },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#94a3b8',
                        borderRadius: 3,
                    },
                }}
            >
                <Grid container spacing={2}>
                    {loading ? (
                        Array.from({ length: 9 }).map((_, index) => (
                            <Grid item xs={12} sm={6} md={4} key={index}>
                                <Paper
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                        borderLeft: '4px solid #3b82f6',
                                    }}
                                >
                                    <Skeleton variant="text" width="40%" height={40} />
                                    <Skeleton variant="text" width="60%" />
                                    <Skeleton variant="text" width="30%" />
                                </Paper>
                            </Grid>
                        ))
                    ) : registeredCounts.length === 0 ? (
                        <Box sx={{ width: '100%', textAlign: 'center', py: 4 }}>
                            <Typography variant="body1" sx={{ color: '#64748b' }}>
                                {searchTerm ? `No results found for "${searchTerm}"` : 'No data available'}
                            </Typography>
                        </Box>
                    ) : (
                        registeredCounts.map((report, index) => (
                            <Grid item xs={12} sm={6} md={4} key={index}>
                                <Paper
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                        borderLeft: `4px solid ${
                                            report['Referral Count'] > 50
                                                ? '#22c55e'
                                                : '#3b82f6'
                                        }`,
                                        transition:
                                            'transform 0.3s ease, box-shadow 0.3s ease',
                                        '&:hover': {
                                            transform: 'translateY(-3px)',
                                            boxShadow:
                                                '0 4px 12px rgba(0, 0, 0, 0.15)',
                                        },
                                        background: '#ffffff',
                                    }}
                                >
                                    <Typography
                                        variant="h4"
                                        sx={{
                                            color:
                                                report['Referral Count'] > 50
                                                    ? '#22c55e'
                                                    : '#3b82f6',
                                            fontWeight: 600,
                                            mb: 1,
                                        }}
                                    >
                                        {report['Referral Count']}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: '#1e3a8a',
                                            fontWeight: 500,
                                            mb: 0.5,
                                        }}
                                    >
                                        Code: {report['Referral Code'] || 'N/A'}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: '#64748b',
                                        }}
                                    >
                                        Type: {report['Referral Type'] || 'N/A'}
                                    </Typography>
                                </Paper>
                            </Grid>
                        ))
                    )}
                </Grid>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mt: 3,
                    pb: 2,
                }}
            >
                {loading ? (
                    <Skeleton
                        variant="rectangular"
                        width={200}
                        height={40}
                        sx={{ borderRadius: 2 }}
                    />
                ) : (
                    <Pagination
                        count={pagination.totalPages}
                        page={pagination.page}
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

export default ReferralCountReports;