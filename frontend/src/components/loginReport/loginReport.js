import React, { useState } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    Link,
    Snackbar,
    Alert,
    Fade,
    CircularProgress,
    InputAdornment,
    IconButton,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import ForgotPasswordDialog from '../loginReport/forgotPassword';

// Define an improved modern theme with adjusted scaling
const theme = createTheme({
    palette: {
        primary: {
            main: '#3b82f6',
            dark: '#2563eb',
        },
        secondary: {
            main: '#f43f5e',
        },
        background: {
            default: 'linear-gradient(135deg, #1e1e2f 0%, #3b82f6 100%)',
        },
    },
    typography: {
        fontFamily: "'Poppins', 'Roboto', sans-serif",
        h5: {
            fontWeight: 700,
            letterSpacing: '0.5px',
            fontSize: '1.5rem', // Reduced from default
        },
        body2: {
            fontWeight: 500,
            fontSize: '0.875rem', // Reduced for smaller text
        },
        body1: {
            fontSize: '0.875rem', // Reduced for general text
        },
    },
    components: {
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: '10px', // Slightly smaller
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        transition: 'all 0.3s ease',
                        fontSize: '0.875rem', // Smaller input text
                        '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        },
                        '&.Mui-focused': {
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)', // Reduced shadow
                        },
                        '& fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                        },
                        '&:hover fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.4)',
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: '#3b82f6',
                        },
                        '&.Mui-error fieldset': {
                            borderColor: '#f43f5e',
                        },
                    },
                    '& .MuiInputLabel-root': {
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontSize: '0.875rem', // Smaller label
                        '&.Mui-focused': {
                            color: '#3b82f6',
                        },
                        '&.Mui-error': {
                            color: '#f43f5e',
                        },
                    },
                    '& .MuiInputBase-input': {
                        color: '#e0e7ff',
                        padding: '10px 12px', // Reduced padding
                    },
                    '& .MuiFormHelperText-root': {
                        color: '#f43f5e',
                        fontWeight: 500,
                        fontSize: '0.75rem', // Smaller helper text
                    },
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 600,
                    padding: '8px 0', // Reduced padding
                    fontSize: '0.875rem', // Smaller button text
                    background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                    boxShadow: '0 3px 12px rgba(59, 130, 246, 0.3)', // Reduced shadow
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        background: 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)',
                        boxShadow: '0 5px 15px rgba(59, 130, 246, 0.5)',
                        transform: 'scale(1.02)',
                    },
                    '&:active': {
                        transform: 'scale(0.98)',
                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
                    },
                    '&:disabled': {
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'rgba(255, 255, 255, 0.3)',
                        boxShadow: 'none',
                    },
                },
            },
        },
    },
});

const LoginReports = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [error, setError] = useState('');
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [openForgotPassword, setOpenForgotPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const validateForm = () => {
        let isValid = true;
        setEmailError('');
        setPasswordError('');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            setEmailError('Email is required');
            isValid = false;
        } else if (!emailRegex.test(email)) {
            setEmailError('Please enter a valid email address');
            isValid = false;
        }

        if (!password) {
            setPasswordError('Password is required');
            isValid = false;
        } else if (password.length < 6) {
            setPasswordError('Password must be at least 6 characters long');
            isValid = false;
        }

        return isValid;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        setError('');

        try {
            const response = await fetch('http://localhost:3003/billing-reports/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token || '5b4f516ae6b5709b5e3a7a540cdaf5b3c8d6f19c0070e38bb8e015be3c66b95b');
                localStorage.setItem('userRoles', JSON.stringify(data.user.roles || []));
                setOpenSnackbar(true);

                setTimeout(() => {
                    navigate('/');
                }, 1000);
            } else {
                const errorMessage = data.message || 'Login failed';
                if (errorMessage.includes('email')) {
                    setEmailError(errorMessage);
                } else if (errorMessage.includes('password')) {
                    setPasswordError(errorMessage);
                } else {
                    setError(errorMessage);
                    setOpenSnackbar(true);
                }
            }
        } catch (err) {
            console.error('Error during login:', err);
            setError('An error occurred. Please try again later.');
            setOpenSnackbar(true);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseSnackbar = () => {
        setOpenSnackbar(false);
    };

    const toggleShowPassword = () => {
        setShowPassword(!showPassword);
    };

    return (
        <ThemeProvider theme={theme}>
            <Box
                sx={{
                    minHeight: '100vh',
                    background: theme.palette.background.default,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.5) 100%)',
                        zIndex: 0,
                    }}
                />
                <Fade in timeout={800}>
                    <Box
                        sx={{
                            width: '100%',
                            maxWidth: '360px', // Reduced from 420px
                            p: 3, // Reduced padding
                            borderRadius: '16px', // Slightly smaller
                            background: 'rgba(255, 255, 255, 0.08)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)', // Reduced shadow
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            zIndex: 1,
                        }}
                    >
                        <LockOutlinedIcon
                            sx={{
                                fontSize: 40, // Reduced size
                                color: '#3b82f6',
                                mb: 1.5, // Reduced margin
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '50%',
                                p: 1, // Reduced padding
                                boxShadow: '0 0 12px rgba(59, 130, 246, 0.3)', // Reduced shadow
                            }}
                        />
                        <Typography
                            component="h1"
                            variant="h5"
                            sx={{
                                fontWeight: 'bold',
                                color: '#e0e7ff',
                                mb: 2, // Reduced margin
                                textAlign: 'center',
                            }}
                        >
                            Welcome Back
                        </Typography>
                        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="email"
                                label="Email Address"
                                name="email"
                                autoComplete="email"
                                autoFocus
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setEmailError('');
                                }}
                                variant="outlined"
                                error={!!emailError}
                                helperText={emailError}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <EmailOutlinedIcon sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.25rem' }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ mb: 1.5 }} // Reduced margin
                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label="Password"
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setPasswordError('');
                                }}
                                variant="outlined"
                                error={!!passwordError}
                                helperText={passwordError}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={toggleShowPassword} edge="end">
                                                {showPassword ? (
                                                    <VisibilityOff sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.25rem' }} />
                                                ) : (
                                                    <Visibility sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.25rem' }} />
                                                )}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ mb: 2 }} // Reduced margin
                            />
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                disabled={loading}
                                sx={{
                                    mt: 0.5, // Reduced margin
                                    mb: 1.5, // Reduced margin
                                    position: 'relative',
                                }}
                            >
                                {loading ? (
                                    <CircularProgress size={20} sx={{ color: '#e0e7ff', position: 'absolute' }} />
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                            <Box sx={{ textAlign: 'center' }}>
                                <Link
                                    href="#"
                                    variant="body2"
                                    onClick={() => setOpenForgotPassword(true)}
                                    sx={{
                                        color: '#e0e7ff',
                                        fontWeight: 500,
                                        textDecoration: 'none',
                                        position: 'relative',
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            color: '#60a5fa',
                                            '&::after': {
                                                width: '100%',
                                            },
                                        },
                                        '&::after': {
                                            content: '""',
                                            position: 'absolute',
                                            width: '0%',
                                            height: '2px',
                                            bottom: '-2px',
                                            left: 0,
                                            backgroundColor: '#60a5fa',
                                            transition: 'width 0.3s ease',
                                        },
                                    }}
                                >
                                    Forgot password?
                                </Link>
                            </Box>
                        </Box>
                    </Box>
                </Fade>
            </Box>

            <Snackbar
                open={openSnackbar}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={error ? 'error' : 'success'}
                    sx={{
                        width: '100%',
                        background: error ? 'rgba(244, 63, 94, 0.9)' : 'rgba(59, 130, 246, 0.9)',
                        color: '#e0e7ff',
                        backdropFilter: 'blur(5px)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                        border: error ? '1px solid #f43f5e' : '1px solid #3b82f6',
                        fontSize: '0.875rem', // Smaller text
                    }}
                >
                    {error || 'Login successful! Redirecting...'}
                </Alert>
            </Snackbar>

            <ForgotPasswordDialog open={openForgotPassword} onClose={() => setOpenForgotPassword(false)} />
        </ThemeProvider>
    );
};

export default LoginReports;