import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    TextField,
    Button,
    Snackbar,
    Alert,
    Fade,
    CircularProgress,
    InputAdornment,
    IconButton,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

const ResetPassword = () => {
    const { resetToken } = useParams();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newPasswordError, setNewPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const navigate = useNavigate();

    const validateForm = () => {
        let isValid = true;
        setNewPasswordError('');
        setConfirmPasswordError('');

        // Password strength validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!newPassword) {
            setNewPasswordError('New password is required');
            isValid = false;
        } else if (!passwordRegex.test(newPassword)) {
            setNewPasswordError('Password must be at least 8 characters long, include uppercase, lowercase, number, and special character');
            isValid = false;
        }

        if (!confirmPassword) {
            setConfirmPasswordError('Confirm password is required');
            isValid = false;
        } else if (newPassword !== confirmPassword) {
            setConfirmPasswordError('Passwords do not match');
            isValid = false;
        }

        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        setError('');
        setSuccessMessage('');

        try {
            const response = await fetch('http://localhost:3003/billing-reports/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ resetToken, newPassword }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccessMessage('Password reset successful! Redirecting to login...');
                setOpenSnackbar(true);
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } else {
                setError(data.message || 'Password reset failed');
                setOpenSnackbar(true);
            }
        } catch (err) {
            console.error('Error during password reset:', err);
            setError('An error occurred. Please try again.');
            setOpenSnackbar(true);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseSnackbar = () => {
        setOpenSnackbar(false);
    };

    const toggleShowNewPassword = () => {
        setShowNewPassword(!showNewPassword);
    };

    const toggleShowConfirmPassword = () => {
        setShowConfirmPassword(!showConfirmPassword);
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #1e1e2f 0%, #3b82f6 100%)', // Same as LoginReports
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
                        maxWidth: '360px', // Reduced from default
                        p: 3, // Reduced padding
                        borderRadius: '16px',
                        background: 'rgba(255, 255, 255, 0.08)', // Glassmorphism
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        zIndex: 1,
                    }}
                >
                    <LockOutlinedIcon
                        sx={{
                            fontSize: 40,
                            color: '#3b82f6',
                            mb: 1.5,
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '50%',
                            p: 1,
                            boxShadow: '0 0 12px rgba(59, 130, 246, 0.3)',
                        }}
                    />
                    <Typography
                        component="h1"
                        variant="h5"
                        sx={{
                            fontWeight: 'bold',
                            color: '#e0e7ff',
                            mb: 2,
                            textAlign: 'center',
                            fontSize: '1.5rem', // Reduced font size
                        }}
                    >
                        Reset Password
                    </Typography>
                    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="newPassword"
                            label="New Password"
                            type={showNewPassword ? 'text' : 'password'}
                            id="newPassword"
                            value={newPassword}
                            onChange={(e) => {
                                setNewPassword(e.target.value);
                                setNewPasswordError('');
                            }}
                            variant="outlined"
                            error={!!newPasswordError}
                            helperText={newPasswordError}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={toggleShowNewPassword} edge="end">
                                            {showNewPassword ? (
                                                <VisibilityOff sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.25rem' }} />
                                            ) : (
                                                <Visibility sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.25rem' }} />
                                            )}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                mb: 1.5, // Reduced margin
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '10px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    transition: 'all 0.3s ease',
                                    fontSize: '0.875rem', // Smaller text
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    },
                                    '&.Mui-focused': {
                                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                        boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
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
                                    fontSize: '0.875rem',
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
                                    fontSize: '0.75rem',
                                },
                            }}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="confirmPassword"
                            label="Confirm Password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                setConfirmPasswordError('');
                            }}
                            variant="outlined"
                            error={!!confirmPasswordError}
                            helperText={confirmPasswordError}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={toggleShowConfirmPassword} edge="end">
                                            {showConfirmPassword ? (
                                                <VisibilityOff sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.25rem' }} />
                                            ) : (
                                                <Visibility sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.25rem' }} />
                                            )}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                mb: 2, // Reduced margin
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '10px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    transition: 'all 0.3s ease',
                                    fontSize: '0.875rem',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    },
                                    '&.Mui-focused': {
                                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                        boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
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
                                    fontSize: '0.875rem',
                                    '&.Mui-focused': {
                                        color: '#3b82f6',
                                    },
                                    '&.Mui-error': {
                                        color: '#f43f5e',
                                    },
                                },
                                '& .MuiInputBase-input': {
                                    color: '#e0e7ff',
                                    padding: '10px 12px',
                                },
                                '& .MuiFormHelperText-root': {
                                    color: '#f43f5e',
                                    fontWeight: 500,
                                    fontSize: '0.75rem',
                                },
                            }}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading}
                            sx={{
                                mt: 0.5, // Reduced margin
                                mb: 1.5, // Reduced margin
                                borderRadius: '10px',
                                textTransform: 'none',
                                fontWeight: 600,
                                padding: '8px 0', // Reduced padding
                                fontSize: '0.875rem', // Smaller text
                                background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                                boxShadow: '0 3px 12px rgba(59, 130, 246, 0.3)',
                                transition: 'all 0.3s ease',
                                position: 'relative',
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
                            }}
                        >
                            {loading ? (
                                <CircularProgress size={20} sx={{ color: '#e0e7ff', position: 'absolute' }} />
                            ) : (
                                'Reset Password'
                            )}
                        </Button>
                    </Box>
                </Box>
            </Fade>

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
                    {error || successMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ResetPassword;