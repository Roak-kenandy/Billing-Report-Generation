import React, { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    Pagination,
    Box,
    Skeleton,
    useMediaQuery,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import {  GetApp } from '@mui/icons-material';
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import ClearIcon from '@mui/icons-material/Clear';

const Collection = () => {
    const [reports, setReports] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    const isSmallScreen = useMediaQuery('(max-width:600px)');
    const [atolls, setAtolls] = useState([]);
    const [selectedAtoll, setSelectedAtoll] = useState('');
    const [selectedIsland, setSelectedIsland] = useState('');
    const [appliedAtoll, setAppliedAtoll] = useState('');
    const [appliedIsland, setAppliedIsland] = useState('');
    const API_URL = `http://localhost:3003/billing-reports`;

    // Fetch atolls and islands data
    useEffect(() => {
        const fetchAtolls = async () => {
            try {
                const response = await fetch(`${API_URL}/getAtolls`);
                const data = await response.json();
                setAtolls(data.data);
            } catch (err) {
                console.error('Error fetching atolls:', err);
            }
        };
        fetchAtolls();
    }, []);

    // Fetch reports from the backend
    const fetchReports = async (page, limit, search = '', start = '', end = '') => {
        setLoading(true);
        try {
            let url = `${API_URL}/getReports?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
            if (start) url += `&startDate=${encodeURIComponent(start)}`;
            if (end) url += `&endDate=${encodeURIComponent(end)}`;

            // Pass the names instead of IDs
            if (appliedAtoll) {
                const selectedAtollName = atolls.find(a => a.atolls_id === appliedAtoll)?.atolls_name;
                if (selectedAtollName) {
                    url += `&atoll=${encodeURIComponent(selectedAtollName)}`;
                }
            }

            if (appliedIsland) {
                const selectedAtollData = atolls.find(a => a.atolls_id === appliedAtoll);
                const selectedIslandName = selectedAtollData?.islands.find(i => i.islands_id === appliedIsland)?.islands_name;
                if (selectedIslandName) {
                    url += `&island=${encodeURIComponent(selectedIslandName)}`;
                }
            }

            const response = await fetch(url);
            const data = await response.json();
            setReports(data.data);
            setPagination(data.pagination);
        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = () => {
        setAppliedStartDate(startDate);
        setAppliedEndDate(endDate);
        setAppliedAtoll(selectedAtoll);
        setAppliedIsland(selectedIsland);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleClearFilter = () => {
        setStartDate('');
        setEndDate('');
        setAppliedStartDate('');
        setAppliedEndDate('');
        setSelectedAtoll('');
        setSelectedIsland('');
        setAppliedAtoll('');
        setAppliedIsland('');
        setSearchTerm('');
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');

        window.location.href = '/reports/login';
    };

    useEffect(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
    }, [searchTerm, appliedStartDate, appliedEndDate, appliedAtoll, appliedIsland]);

    // Fetch reports on component mount and when pagination/search changes
    useEffect(() => {
        fetchReports(pagination.page, pagination.limit, searchTerm, appliedStartDate, appliedEndDate);
    }, [pagination.page, pagination.limit, searchTerm, appliedStartDate, appliedEndDate,appliedAtoll, appliedIsland]);

    // Handle page change
    const handlePageChange = (event, value) => {
        setPagination({ ...pagination, page: value });
    };

    // Handle search
    const handleSearch = (event) => {
        setSearchTerm(event.target.value);
        setPagination({ ...pagination, page: 1 }); // Reset to first page on search
    };

    const handleDownloadCSV = async () => {
        try {
            setIsDownloading(true);
            let url = new URL(`${API_URL}/getCollectionReports`, window.location.origin);
            url.searchParams.append('search', searchTerm);
            if (appliedStartDate) url.searchParams.append('startDate', appliedStartDate);
            if (appliedEndDate) url.searchParams.append('endDate', appliedEndDate);

            if (appliedAtoll) {
                const selectedAtollName = atolls.find(a => a.atolls_id === appliedAtoll)?.atolls_name;
                if (selectedAtollName) {
                    url += `&atoll=${encodeURIComponent(selectedAtollName)}`;
                }
            }

            if (appliedIsland) {
                const selectedAtollData = atolls.find(a => a.atolls_id === appliedAtoll);
                const selectedIslandName = selectedAtollData?.islands.find(i => i.islands_id === appliedIsland)?.islands_name;
                if (selectedIslandName) {
                    url += `&island=${encodeURIComponent(selectedIslandName)}`;
                }
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', 'reports.csv');
            document.body.appendChild(link);
            link.click();

            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Export error:', error);
            // Show error notification
        } finally {
            setIsDownloading(false);
        }
    };



    return (
        <Box sx={{
            padding: 3,
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 37px)',
            overflow: 'hidden'
        }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
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
                        '& > *': { minWidth: isSmallScreen ? '100%' : 'auto' },
                    }}
                >
                    <DatePicker
                        label="Start Date"
                        value={startDate}
                        onChange={(newValue) => setStartDate(newValue)}
                        slotProps={{
                            textField: {
                                InputLabelProps: { shrink: true },
                                sx: {
                                    width: isSmallScreen ? '100%' : 180,
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        backgroundColor: '#f1f5f9',
                                    },
                                },
                            },
                        }}
                    />

                    <DatePicker
                        label="End Date"
                        value={endDate}
                        onChange={(newValue) => setEndDate(newValue)}
                        slotProps={{
                            textField: {
                                InputLabelProps: { shrink: true },
                                sx: {
                                    width: isSmallScreen ? '100%' : 180,
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        backgroundColor: '#f1f5f9',
                                    },
                                },
                            },
                        }}
                    />

                    <FormControl sx={{ width: isSmallScreen ? '100%' : 180 }}>
                        <InputLabel sx={{ color: '#64748b' }}>Atoll</InputLabel>
                        <Select
                            value={selectedAtoll}
                            label="Atoll"
                            onChange={(e) => {
                                setSelectedAtoll(e.target.value);
                                setSelectedIsland('');
                            }}
                            sx={{
                                borderRadius: 2,
                                backgroundColor: '#f1f5f9',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#e2e8f0',
                                },
                            }}
                        >
                            <MenuItem value="">All Atolls</MenuItem>
                            {atolls.map((atoll) => (
                                <MenuItem key={atoll.atolls_id} value={atoll.atolls_id}>
                                    {atoll.atolls_name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl sx={{ width: isSmallScreen ? '100%' : 180 }}>
                        <InputLabel sx={{ color: '#64748b' }}>Island</InputLabel>
                        <Select
                            value={selectedIsland}
                            label="Island"
                            onChange={(e) => setSelectedIsland(e.target.value)}
                            disabled={!selectedAtoll}
                            sx={{
                                borderRadius: 2,
                                backgroundColor: '#f1f5f9',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#e2e8f0',
                                },
                            }}
                        >
                            <MenuItem value="">All Islands</MenuItem>
                            {atolls
                                .find((a) => a.atolls_id === selectedAtoll)
                                ?.islands.map((island) => (
                                    <MenuItem key={island.islands_id} value={island.islands_id}>
                                        {island.islands_name}
                                    </MenuItem>
                                ))}
                        </Select>
                    </FormControl>

                    <Button
                        variant="contained"
                        onClick={handleFilter}
                        startIcon={<FilterAltIcon />}
                        sx={{
                            width: isSmallScreen ? '100%' : 'auto',
                            height: 48,
                            borderRadius: 2,
                            backgroundColor: '#3b82f6',
                            textTransform: 'none',
                            fontWeight: 500,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                backgroundColor: '#2563eb',
                                transform: 'translateY(-2px)',
                            },
                        }}
                    >
                        Filter
                    </Button>

                    <Button
                        variant="outlined"
                        onClick={handleClearFilter}
                        startIcon={<ClearIcon />}
                        sx={{
                            width: isSmallScreen ? '100%' : 'auto',
                            height: 48,
                            borderRadius: 2,
                            borderColor: '#e2e8f0',
                            color: '#64748b',
                            textTransform: 'none',
                            fontWeight: 500,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                borderColor: '#3b82f6',
                                color: '#3b82f6',
                                transform: 'translateY(-2px)',
                            },
                        }}
                    >
                        Clear Filters
                    </Button>

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
            </LocalizationProvider>

        </Box>
    );
};

export default Collection;


