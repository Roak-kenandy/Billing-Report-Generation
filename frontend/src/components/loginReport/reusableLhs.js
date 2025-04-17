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
    CloudUpload as CloudUploadIcon,
    Assignment as AssignmentIcon,
    HowToReg as HowToRegIcon,
    BarChart as BarChartIcon
} from '@mui/icons-material';

const ReusableLhs = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [openFinancialSubmenu, setOpenFinancialSubmenu] = useState(false);
    const [openSalesSubmenu, setOpenSalesSubmenu] = useState(false);
    const [openRbacSubmenu, setOpenRbacSubmenu] = useState(false);
    const [openMtvRegisterSubmenu, setOpenMtvregisterSubmenu] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [userRoles, setUserRoles] = useState([]);

    const financialReportItems = [
        { name: 'Subscription Reports', path: '/subscription', icon: <DescriptionIcon /> },
        { name: 'Dealer Reports', path: '/dealer', icon: <PeopleIcon /> },
        { name: 'Collection Reports', path: '/collection', icon: <MonetizationOnIcon /> },
        { name: 'Bulk Uploads', path: '/bulkUploads', icon: <CloudUploadIcon /> },
        { name: 'Bulk Dealer Uploads', path: '/bulkDealerUploads', icon: <CloudUploadIcon /> },
        { name: 'Manual Journal Reports', path: '/manualJournal', icon: <BookIcon /> },
    ];

    const salesReportItems = [
        { name: 'Service Request Reports', path: '/serviceRequest', icon: <SupportAgentIcon /> },
    ];

    const rbacReportItems = [
        { name: 'User Roles', path: '/rbac/roles', icon: <PeopleIcon /> },
    ];

    const mtvRegisterReportItems = [
        { name: 'Registered Customer', path: '/mtv/registered', icon: <HowToRegIcon /> },
        { name: 'Registered Customer Counts', path: '/mtv/registered/counts', icon: <BarChartIcon /> },
    ];

    // Initialize component state based on current location and stored preferences
    useEffect(() => {
        // Check authentication
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/reports/login');
            return;
        }

        // Fetch user roles
        const roles = JSON.parse(localStorage.getItem('userRoles')) || [];
        setUserRoles(roles);

        // Restore submenu states from localStorage
        setOpenFinancialSubmenu(JSON.parse(localStorage.getItem('financialSubmenuOpen')) || false);
        setOpenSalesSubmenu(JSON.parse(localStorage.getItem('salesSubmenuOpen')) || false);
        setOpenRbacSubmenu(JSON.parse(localStorage.getItem('rbacSubmenuOpen')) || false);

        // Set selected index based on current path
        const allMenuItems = [
            { path: '/dashboard' },
            ...financialReportItems,
            ...salesReportItems,
            ...rbacReportItems,
            ...mtvRegisterReportItems,
        ];
        const currentIndex = allMenuItems.findIndex(item => item.path === location.pathname);
        setSelectedIndex(currentIndex >= 0 ? currentIndex : 0);

        // Auto-expand the relevant submenu based on current path
        if (financialReportItems.some(item => item.path === location.pathname)) {
            setOpenFinancialSubmenu(true);
            localStorage.setItem('financialSubmenuOpen', JSON.stringify(true));
        } else if (salesReportItems.some(item => item.path === location.pathname)) {
            setOpenSalesSubmenu(true);
            localStorage.setItem('salesSubmenuOpen', JSON.stringify(true));
        } else if (rbacReportItems.some(item => item.path === location.pathname)) {
            setOpenRbacSubmenu(true);
            localStorage.setItem('rbacSubmenuOpen', JSON.stringify(true));
        }
        else if (mtvRegisterReportItems.some(item => item.path === location.pathname)) {
            setOpenRbacSubmenu(true);
            localStorage.setItem('mtvRegisterSubmenuOpen', JSON.stringify(true));
        }
    }, [location.pathname, navigate]);

    // Redirect to dashboard if root path
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
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/reports/login';
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const handleSubmenuToggle = (menu) => {
        if (menu === 'financial') {
            const newState = !openFinancialSubmenu;
            setOpenFinancialSubmenu(newState);
            setOpenSalesSubmenu(false);
            setOpenRbacSubmenu(false);
            setOpenMtvregisterSubmenu(false);
            localStorage.setItem('financialSubmenuOpen', JSON.stringify(newState));
            localStorage.setItem('salesSubmenuOpen', JSON.stringify(false));
            localStorage.setItem('rbacSubmenuOpen', JSON.stringify(false));
            localStorage.setItem('mtvRegisterSubmenuOpen', JSON.stringify(false));
        } else if (menu === 'sales') {
            const newState = !openSalesSubmenu;
            setOpenSalesSubmenu(newState);
            setOpenFinancialSubmenu(false);
            setOpenRbacSubmenu(false);
            setOpenMtvregisterSubmenu(false);
            localStorage.setItem('salesSubmenuOpen', JSON.stringify(newState));
            localStorage.setItem('financialSubmenuOpen', JSON.stringify(false));
            localStorage.setItem('rbacSubmenuOpen', JSON.stringify(false));
            localStorage.setItem('mtvRegisterSubmenuOpen', JSON.stringify(false));
        } else if (menu === 'rbac') {
            const newState = !openRbacSubmenu;
            setOpenRbacSubmenu(newState);
            setOpenFinancialSubmenu(false);
            setOpenSalesSubmenu(false);
            setOpenMtvregisterSubmenu(false);
            localStorage.setItem('rbacSubmenuOpen', JSON.stringify(newState));
            localStorage.setItem('financialSubmenuOpen', JSON.stringify(false));
            localStorage.setItem('salesSubmenuOpen', JSON.stringify(false));
            localStorage.setItem('mtvRegisterSubmenuOpen', JSON.stringify(false));
        }
        else if (menu === 'mtvRegister') {
            const newState = !openMtvRegisterSubmenu;
            setOpenMtvregisterSubmenu(newState);
            setOpenFinancialSubmenu(false);
            setOpenSalesSubmenu(false);
            setOpenRbacSubmenu(false);
            localStorage.setItem('mtvRegisterSubmenuOpen', JSON.stringify(newState));
            localStorage.setItem('financialSubmenuOpen', JSON.stringify(false));
            localStorage.setItem('salesSubmenuOpen', JSON.stringify(false));
            localStorage.setItem('rbacSubmenuOpen', JSON.stringify(false));
        }
    };

    const canViewFinancialReports = userRoles.includes('Finance') || userRoles.includes('Admin');
    const canViewSalesDepartment = userRoles.includes('Sales') || userRoles.includes('Admin');
    const canViewRbacManagement = userRoles.includes('Admin');
    const canViewMtvUsersManagement = userRoles.includes('Admin') || userRoles.includes('Sales');

    // Rest of your JSX remains the same...
    // Return statement with Box, List, etc. stays unchanged
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
                            onClick={() => handleListItemClick(0, '/dashboard')}
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

                        {/* Financial Reports Section */}
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
                                            onClick={() => handleListItemClick(index + 1, item.path)}
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

                        {/* Sales Department Section */}
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
                                            onClick={() => handleListItemClick(index + financialReportItems.length + 1, item.path)}
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

                        {/* Register Reports Section */}
                        {canViewMtvUsersManagement && (
                            <>
                                <ListItemButton
                                    onClick={() => handleSubmenuToggle('mtvRegister')}
                                    sx={{
                                        py: 1.5,
                                        mx: 1,
                                        borderRadius: 2,
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        },
                                        backgroundColor: openMtvRegisterSubmenu ? 'rgba(255, 255, 255, 0.05)' : 'inherit',
                                    }}
                                >
                                    <ListItemIcon sx={{ color: '#e0e7ff', minWidth: '40px' }}>
                                        <AssignmentIcon />
                                    </ListItemIcon>
                                    {isSidebarOpen && (
                                        <>
                                            <ListItemText
                                                primary="MTV Register Reports"
                                                primaryTypographyProps={{ fontWeight: 500 }}
                                            />
                                            {openMtvRegisterSubmenu ? (
                                                <ExpandLess sx={{ color: '#93c5fd' }} />
                                            ) : (
                                                <ExpandMore sx={{ color: '#93c5fd' }} />
                                            )}
                                        </>
                                    )}
                                </ListItemButton>

                                <Collapse in={openMtvRegisterSubmenu && isSidebarOpen} timeout="auto" unmountOnExit>
                                    {mtvRegisterReportItems.map((item, index) => (
                                        <ListItemButton
                                            key={item.name}
                                            selected={location?.pathname === item.path}
                                            onClick={() => handleListItemClick(
                                                index + financialReportItems.length + salesReportItems.length + 1,
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

                        {/* RBAC Section */}
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
                                                index + financialReportItems.length + salesReportItems.length + 1,
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
                    overflow: 'hidden'
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
};

export default ReusableLhs;