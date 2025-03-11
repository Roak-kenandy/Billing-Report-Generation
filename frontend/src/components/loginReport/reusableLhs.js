import React, { useState, useEffect } from 'react'; // Add useEffect
import {
    List,
    ListItemButton,
    ListItemText,
    Divider,
    Collapse,
    Box,
    Button,
    Typography
} from '@mui/material';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom'; // Add useLocation
import { ExpandLess, ExpandMore } from '@mui/icons-material';

const ReusableLhs = () => {
    const navigate = useNavigate();
    const location = useLocation(); // Get the current location
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [openSubmenu, setOpenSubmenu] = useState(true);

    const handleListItemClick = (index, path) => {
        setSelectedIndex(index);
        navigate(path);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');

        window.location.href = '/reports/login';
    };

    const reportItems = [
        { name: 'Subscription Reports', path: '/subscription' },
        { name: 'Dealer Reports',path: '/dealer'}
    ];

    // Redirect to /subscription if the current path is the root
    useEffect(() => {
        if (location.pathname === '/') {
            navigate('/dashboard');
        }
    }, [location.pathname, navigate]);

    return (
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* LHS Navigation Panel - 20% width */}
            <Box sx={{
                width: '20%', // 20% width
                minWidth: '250px', // Minimum width to prevent shrinking
                maxWidth: '300px', // Maximum width to prevent expanding
                backgroundColor: '#1a237e',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                boxShadow: 3,
            }}>
                <Box sx={{ p: 2, textAlign: 'center', borderBottom: '1px solid #34495e' }}>
                    <Typography variant="h6">Reports Dashboard</Typography>
                </Box>

                <List component="nav" sx={{ flexGrow: 1 }}>

                <ListItemButton
                        component={Link}
                        to="/dashboard"
                        selected={location?.pathname === '/dashboard'}
                        sx={{
                            '&:hover': { backgroundColor: '#34495e' },
                            '&.Mui-selected': {
                                backgroundColor: '#3498db',
                                '&:hover': { backgroundColor: '#2980b9' }
                            }
                        }}
                    >
                        <ListItemText primary="Dashboard" />
                    </ListItemButton>
                    <ListItemButton
                        onClick={() => setOpenSubmenu(!openSubmenu)}
                        sx={{
                            '&:hover': { backgroundColor: '#34495e' },
                            backgroundColor: openSubmenu ? '#34495e' : 'inherit'
                        }}
                    >
                        <ListItemText primary="Financial Reports" />
                        {openSubmenu ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>

                    <Collapse in={openSubmenu} timeout="auto" unmountOnExit>
                        {reportItems.map((item, index) => {
                            console.log("Item:", item, "Index:", index); // Logs each item and its index

                            return (
                                <ListItemButton
                                    key={item.name}
                                    selected={location?.pathname === item.path}
                                    // selected={selectedIndex === index}
                                    onClick={() => handleListItemClick(index, item.path)}
                                    component={Link}
                                    to={item.path}
                                    sx={{
                                        pl: 4,
                                        '&.Mui-selected': {
                                            backgroundColor: '#007bff',
                                            '&:hover': { backgroundColor: '#2980b9' }
                                        },
                                        '&:hover': { backgroundColor: '#34495e' }
                                    }}
                                >
                                    <ListItemText
                                        primary={item.name}
                                        primaryTypographyProps={{ fontSize: 14 }}
                                    />
                                </ListItemButton>
                            );
                        })}

                    </Collapse>

                    <Divider sx={{ borderColor: '#34495e', my: 1 }} />
                </List>

                <Box sx={{ p: 2, borderTop: '1px solid #34495e' }}>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={handleLogout}
                        sx={{
                            borderRadius: 2,
                            backgroundColor: '#4CAF50',
                            '&:hover': { backgroundColor: '#43a047' },
                            fontWeight: 500,
                            letterSpacing: '0.5px'
                        }}
                    >
                        Logout
                    </Button>
                </Box>
            </Box>

            {/* RHS Content Area - 80% width */}
            <Box sx={{
                flexGrow: 1,
                width: '80%', // 80% width
                overflow: 'auto',
                backgroundColor: '#f5f6fa',
                display: 'flex',
                flexDirection: 'column',
                gap: 2
            }}>
                {/* Outlet for nested routes */}
                <Outlet />
            </Box>
        </Box>
    );
};

export default ReusableLhs;