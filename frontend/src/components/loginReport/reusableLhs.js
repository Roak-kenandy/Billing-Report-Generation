import React, { useState, useEffect } from 'react';
import {
    List,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Divider,
    Collapse,
    Box,
    Button,
    Typography,
    IconButton,
} from '@mui/material';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
    ExpandLess,
    ExpandMore,
    Menu as MenuIcon,
    Close as CloseIcon,
    Dashboard as DashboardIcon,
    MonetizationOn as MonetizationOnIcon,
    Description as DescriptionIcon,
    People as PeopleIcon,
    SupportAgent as SupportAgentIcon,
    ExitToApp as ExitToAppIcon,
    Store as StoreIcon,
    Book as BookIcon,
    Lock as LockIcon,
} from '@mui/icons-material';

const ReusableLhs = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [openFinancialSubmenu, setOpenFinancialSubmenu] = useState(false);
    const [openSalesSubmenu, setOpenSalesSubmenu] = useState(false);
    const [openRbacSubmenu, setOpenRbacSubmenu] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [userRoles, setUserRoles] = useState([]); // State to store user roles as an array

    // Fetch user roles on component mount
    useEffect(() => {
        // Check if user is logged in
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/reports/login');
            return;
        }

        // Fetch user roles from localStorage (set during login)
        const roles = JSON.parse(localStorage.getItem('userRoles')) || [];
        setUserRoles(roles);
    }, [navigate]);

    useEffect(() => {
        if (location.pathname === '/') {
            navigate('/dashboard');
        }
    }, [location.pathname, navigate]);

    const handleListItemClick = (index, path) => {
        setSelectedIndex(index);
        navigate(path);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        localStorage.removeItem('userRoles'); // Clear roles on logout
        window.location.href = '/reports/login';
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const handleSubmenuToggle = (menu) => {
        if (menu === 'financial') {
            setOpenFinancialSubmenu(!openFinancialSubmenu);
            setOpenSalesSubmenu(false);
            setOpenRbacSubmenu(false);
        } else if (menu === 'sales') {
            setOpenSalesSubmenu(!openSalesSubmenu);
            setOpenFinancialSubmenu(false);
            setOpenRbacSubmenu(false);
        } else if (menu === 'rbac') {
            setOpenRbacSubmenu(!openRbacSubmenu);
            setOpenFinancialSubmenu(false);
            setOpenSalesSubmenu(false);
        }
    };

    const financialReportItems = [
        { name: 'Subscription Reports', path: '/subscription', icon: <DescriptionIcon /> },
        { name: 'Dealer Reports', path: '/dealer', icon: <PeopleIcon /> },
        { name: 'Collection Reports', path: '/collection', icon: <MonetizationOnIcon /> },
        { name: 'Manual Journal Reports', path: '/manualJournal', icon: <BookIcon /> },
    ];

    const salesReportItems = [
        { name: 'Service Request Reports', path: '/serviceRequest', icon: <SupportAgentIcon /> },
    ];

    const rbacReportItems = [
        { name: 'User Roles', path: '/rbac/roles', icon: <PeopleIcon /> },
        { name: 'Permissions', path: '/rbac/permissions', icon: <LockIcon /> },
    ];

    // Role-based visibility logic for multiple roles
    const canViewFinancialReports = userRoles.includes('Finance') || userRoles.includes('Admin');
    const canViewSalesDepartment = userRoles.includes('Sales') || userRoles.includes('Admin');
    const canViewRbacManagement = userRoles.includes('Admin');

    return (
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* LHS Navigation Panel */}
            <Box
                sx={{
                    width: isSidebarOpen ? '20%' : '60px',
                    minWidth: isSidebarOpen ? '250px' : '60px',
                    maxWidth: isSidebarOpen ? '300px' : '60px',
                    background: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    boxShadow: '4px 0 15px rgba(0, 0, 0, 0.2)',
                    transition: 'all 0.3s ease-in-out',
                }}
            >
                {/* Header Section */}
                <Box
                    sx={{
                        p: isSidebarOpen ? 3 : 1,
                        textAlign: 'center',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    {isSidebarOpen && (
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 600,
                                letterSpacing: '0.5px',
                                color: '#e0e7ff',
                            }}
                        >
                            Reports
                        </Typography>
                    )}
                    <IconButton onClick={toggleSidebar} sx={{ color: '#e0e7ff' }}>
                        {isSidebarOpen ? <CloseIcon /> : <MenuIcon />}
                    </IconButton>
                </Box>

                {/* Scrollable Menu Section */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                    <List component="nav" sx={{ py: 1 }}>
                        {/* Dashboard (visible to all roles) */}
                        <ListItemButton
                            component={Link}
                            to="/dashboard"
                            selected={location?.pathname === '/dashboard'}
                            sx={{
                                py: 1.5,
                                mx: 1,
                                borderRadius: 2,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    transform: isSidebarOpen ? 'translateX(5px)' : 'none',
                                },
                                '&.Mui-selected': {
                                    backgroundColor: '#3b82f6',
                                    color: '#ffffff',
                                    '&:hover': { backgroundColor: '#2563eb' },
                                },
                            }}
                        >
                            <ListItemIcon sx={{ color: '#e0e7ff', minWidth: '40px' }}>
                                <DashboardIcon />
                            </ListItemIcon>
                            {isSidebarOpen && (
                                <ListItemText
                                    primary="Dashboard"
                                    primaryTypographyProps={{ fontWeight: 500 }}
                                />
                            )}
                        </ListItemButton>

                        {/* Financial Reports Section (visible to Finance and Admin) */}
                        {canViewFinancialReports && (
                            <>
                                <ListItemButton
                                    onClick={() => handleSubmenuToggle('financial')}
                                    sx={{
                                        py: 1.5,
                                        mx: 1,
                                        borderRadius: 2,
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        },
                                        backgroundColor: openFinancialSubmenu ? 'rgba(255, 255, 255, 0.05)' : 'inherit',
                                    }}
                                >
                                    <ListItemIcon sx={{ color: '#e0e7ff', minWidth: '40px' }}>
                                        <MonetizationOnIcon />
                                    </ListItemIcon>
                                    {isSidebarOpen && (
                                        <>
                                            <ListItemText
                                                primary="Financial Reports"
                                                primaryTypographyProps={{ fontWeight: 500 }}
                                            />
                                            {openFinancialSubmenu ? (
                                                <ExpandLess sx={{ color: '#93c5fd' }} />
                                            ) : (
                                                <ExpandMore sx={{ color: '#93c5fd' }} />
                                            )}
                                        </>
                                    )}
                                </ListItemButton>

                                <Collapse in={openFinancialSubmenu && isSidebarOpen} timeout="auto" unmountOnExit>
                                    {financialReportItems.map((item, index) => (
                                        <ListItemButton
                                            key={item.name}
                                            selected={location?.pathname === item.path}
                                            onClick={() => handleListItemClick(index, item.path)}
                                            component={Link}
                                            to={item.path}
                                            sx={{
                                                pl: isSidebarOpen ? 5 : 1,
                                                py: 1.2,
                                                mx: 1,
                                                borderRadius: 2,
                                                transition: 'all 0.3s ease',
                                                '&:hover': {
                                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                    transform: isSidebarOpen ? 'translateX(5px)' : 'none',
                                                },
                                                '&.Mui-selected': {
                                                    backgroundColor: '#3b82f6',
                                                    color: '#ffffff',
                                                    '&:hover': { backgroundColor: '#2563eb' },
                                                },
                                            }}
                                        >
                                            <ListItemIcon sx={{ color: '#e0e7ff', minWidth: '40px' }}>
                                                {item.icon}
                                            </ListItemIcon>
                                            {isSidebarOpen && (
                                                <ListItemText
                                                    primary={item.name}
                                                    primaryTypographyProps={{
                                                        fontSize: 14,
                                                        fontWeight: 400,
                                                    }}
                                                />
                                            )}
                                        </ListItemButton>
                                    ))}
                                </Collapse>
                            </>
                        )}

                        {/* Sales Department Section (visible to Sales and Admin) */}
                        {canViewSalesDepartment && (
                            <>
                                <ListItemButton
                                    onClick={() => handleSubmenuToggle('sales')}
                                    sx={{
                                        py: 1.5,
                                        mx: 1,
                                        borderRadius: 2,
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        },
                                        backgroundColor: openSalesSubmenu ? 'rgba(255, 255, 255, 0.05)' : 'inherit',
                                    }}
                                >
                                    <ListItemIcon sx={{ color: '#e0e7ff', minWidth: '40px' }}>
                                        <StoreIcon />
                                    </ListItemIcon>
                                    {isSidebarOpen && (
                                        <>
                                            <ListItemText
                                                primary="Sales Department"
                                                primaryTypographyProps={{ fontWeight: 500 }}
                                            />
                                            {openSalesSubmenu ? (
                                                <ExpandLess sx={{ color: '#93c5fd' }} />
                                            ) : (
                                                <ExpandMore sx={{ color: '#93c5fd' }} />
                                            )}
                                        </>
                                    )}
                                </ListItemButton>

                                <Collapse in={openSalesSubmenu && isSidebarOpen} timeout="auto" unmountOnExit>
                                    {salesReportItems.map((item, index) => (
                                        <ListItemButton
                                            key={item.name}
                                            selected={location?.pathname === item.path}
                                            onClick={() => handleListItemClick(index + financialReportItems.length, item.path)}
                                            component={Link}
                                            to={item.path}
                                            sx={{
                                                pl: isSidebarOpen ? 5 : 1,
                                                py: 1.2,
                                                mx: 1,
                                                borderRadius: 2,
                                                transition: 'all 0.3s ease',
                                                '&:hover': {
                                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                    transform: isSidebarOpen ? 'translateX(5px)' : 'none',
                                                },
                                                '&.Mui-selected': {
                                                    backgroundColor: '#3b82f6',
                                                    color: '#ffffff',
                                                    '&:hover': { backgroundColor: '#2563eb' },
                                                },
                                            }}
                                        >
                                            <ListItemIcon sx={{ color: '#e0e7ff', minWidth: '40px' }}>
                                                {item.icon}
                                            </ListItemIcon>
                                            {isSidebarOpen && (
                                                <ListItemText
                                                    primary={item.name}
                                                    primaryTypographyProps={{
                                                        fontSize: 14,
                                                        fontWeight: 400,
                                                    }}
                                                />
                                            )}
                                        </ListItemButton>
                                    ))}
                                </Collapse>
                            </>
                        )}

                        {/* RBAC Section (visible to Admin only) */}
                        {canViewRbacManagement && (
                            <>
                                <ListItemButton
                                    onClick={() => handleSubmenuToggle('rbac')}
                                    sx={{
                                        py: 1.5,
                                        mx: 1,
                                        borderRadius: 2,
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        },
                                        backgroundColor: openRbacSubmenu ? 'rgba(255, 255, 255, 0.05)' : 'inherit',
                                    }}
                                >
                                    <ListItemIcon sx={{ color: '#e0e7ff', minWidth: '40px' }}>
                                        <LockIcon />
                                    </ListItemIcon>
                                    {isSidebarOpen && (
                                        <>
                                            <ListItemText
                                                primary="RBAC Management"
                                                primaryTypographyProps={{ fontWeight: 500 }}
                                            />
                                            {openRbacSubmenu ? (
                                                <ExpandLess sx={{ color: '#93c5fd' }} />
                                            ) : (
                                                <ExpandMore sx={{ color: '#93c5fd' }} />
                                            )}
                                        </>
                                    )}
                                </ListItemButton>

                                <Collapse in={openRbacSubmenu && isSidebarOpen} timeout="auto" unmountOnExit>
                                    {rbacReportItems.map((item, index) => (
                                        <ListItemButton
                                            key={item.name}
                                            selected={location?.pathname === item.path}
                                            onClick={() => handleListItemClick(
                                                index + financialReportItems.length + salesReportItems.length,
                                                item.path
                                            )}
                                            component={Link}
                                            to={item.path}
                                            sx={{
                                                pl: isSidebarOpen ? 5 : 1,
                                                py: 1.2,
                                                mx: 1,
                                                borderRadius: 2,
                                                transition: 'all 0.3s ease',
                                                '&:hover': {
                                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                    transform: isSidebarOpen ? 'translateX(5px)' : 'none',
                                                },
                                                '&.Mui-selected': {
                                                    backgroundColor: '#3b82f6',
                                                    color: '#ffffff',
                                                    '&:hover': { backgroundColor: '#2563eb' },
                                                },
                                            }}
                                        >
                                            <ListItemIcon sx={{ color: '#e0e7ff', minWidth: '40px' }}>
                                                {item.icon}
                                            </ListItemIcon>
                                            {isSidebarOpen && (
                                                <ListItemText
                                                    primary={item.name}
                                                    primaryTypographyProps={{
                                                        fontSize: 14,
                                                        fontWeight: 400,
                                                    }}
                                                />
                                            )}
                                        </ListItemButton>
                                    ))}
                                </Collapse>
                            </>
                        )}

                        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', my: 2 }} />
                    </List>
                </Box>

                {/* Fixed Logout Button Section */}
                <Box
                    sx={{
                        p: isSidebarOpen ? 3 : 1,
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    }}
                >
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={handleLogout}
                        sx={{
                            borderRadius: 8,
                            backgroundColor: '#22c55e',
                            py: isSidebarOpen ? 1.5 : 1,
                            fontWeight: 600,
                            letterSpacing: '0.5px',
                            textTransform: 'none',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                backgroundColor: '#16a34a',
                                transform: isSidebarOpen ? 'scale(1.02)' : 'none',
                            },
                            display: isSidebarOpen ? 'block' : 'none',
                        }}
                    >
                        {isSidebarOpen ? 'Logout' : <ExitToAppIcon />}
                    </Button>
                    {!isSidebarOpen && (
                        <IconButton
                            onClick={handleLogout}
                            sx={{ color: '#e0e7ff', width: '100%' }}
                        >
                            <ExitToAppIcon />
                        </IconButton>
                    )}
                </Box>
            </Box>

            {/* RHS Content Area */}
            <Box
                sx={{
                    flexGrow: 1,
                    width: isSidebarOpen ? '80%' : 'calc(100% - 60px)',
                    overflowY: 'auto',
                    backgroundColor: '#f9fafb',
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    transition: 'all 0.3s ease',
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
};

export default ReusableLhs;