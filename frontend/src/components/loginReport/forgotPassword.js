import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Typography,
    Box,
    CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

const ForgotPasswordDialog = ({ open, onClose }) => {
    const theme = useTheme();
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setEmailError('');
        setSuccessMessage('');
        setErrorMessage('');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            setEmailError('Email is required');
            return;
        } else if (!emailRegex.test(email)) {
            setEmailError('Please enter a valid email address');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('http://localhost:3003/billing-reports/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccessMessage('Password reset link sent to your email.');
                setTimeout(() => {
                    onClose();
                    setEmail('');
                    setSuccessMessage('');
                }, 2000);
            } else {
                setErrorMessage(data.message || 'Failed to send reset link.');
            }
        } catch (err) {
            console.error('Error during password reset request:', err);
            setErrorMessage('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderRadius: '16px', // Slightly smaller
                    background: 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)', // Reduced shadow
                    width: '100%',
                    maxWidth: '360px', // Reduced from 400px
                },
            }}
        >
            <DialogTitle
                sx={{
                    textAlign: 'center',
                    color: '#e0e7ff',
                    fontWeight: 700,
                    fontFamily: "'Poppins', 'Roboto', sans-serif",
                    letterSpacing: '0.5px',
                    pb: 0.5, // Reduced padding
                    fontSize: '1.25rem', // Smaller title
                }}
            >
                Forgot Password
            </DialogTitle>
            <DialogContent>
                <Typography
                    variant="body2"
                    sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        textAlign: 'center',
                        mb: 1.5, // Reduced margin
                        fontFamily: "'Poppins', 'Roboto', sans-serif",
                    }}
                >
                    Enter your email address to receive a password reset link.
                </Typography>
                <TextField
                    autoFocus
                    margin="dense"
                    label="Email Address"
                    type="email"
                    fullWidth
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError('');
                    }}
                    variant="outlined"
                    error={!!emailError}
                    helperText={emailError}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '10px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            transition: 'all 0.3s ease',
                            fontSize: '0.875rem', // Smaller input text
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
                                borderColor: theme.palette.primary.main,
                            },
                            '&.Mui-error fieldset': {
                                borderColor: theme.palette.secondary.main,
                            },
                        },
                        '& .MuiInputLabel-root': {
                            color: 'rgba(255, 255, 255, 0.6)',
                            fontSize: '0.875rem',
                            '&.Mui-focused': {
                                color: theme.palette.primary.main,
                            },
                            '&.Mui-error': {
                                color: theme.palette.secondary.main,
                            },
                        },
                        '& .MuiInputBase-input': {
                            color: '#e0e7ff',
                            padding: '10px 12px', // Reduced padding
                        },
                        '& .MuiFormHelperText-root': {
                            color: theme.palette.secondary.main,
                            fontWeight: 500,
                            fontSize: '0.75rem',
                        },
                    }}
                />
                {successMessage && (
                    <Typography
                        variant="body2"
                        sx={{
                            color: theme.palette.primary.main,
                            textAlign: 'center',
                            mt: 1.5, // Reduced margin
                            fontWeight: 500,
                        }}
                    >
                        {successMessage}
                    </Typography>
                )}
                {errorMessage && (
                    <Typography
                        variant="body2"
                        sx={{
                            color: theme.palette.secondary.main,
                            textAlign: 'center',
                            mt: 1.5, // Reduced margin
                            fontWeight: 500,
                        }}
                    >
                        {errorMessage}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', pb: 2, px: 2, gap: 1.5 }}>
                <Button
                    onClick={onClose}
                    sx={{
                        borderRadius: '10px',
                        textTransform: 'none',
                        fontWeight: 600,
                        padding: '8px 16px', // Reduced padding
                        fontSize: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#e0e7ff',
                        boxShadow: 'none',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            background: 'rgba(255, 255, 255, 0.15)',
                            boxShadow: '0 3px 12px rgba(255, 255, 255, 0.1)',
                            transform: 'scale(1.02)',
                        },
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    sx={{
                        borderRadius: '10px',
                        textTransform: 'none',
                        fontWeight: 600,
                        padding: '8px 16px', // Reduced padding
                        fontSize: '0.875rem',
                        background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                        boxShadow: '0 3px 12px rgba(59, 130, 246, 0.3)',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        color: '#e0e7ff',
                        '&:hover': {
                            background: 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)',
                            boxShadow: '0 5px 15px rgba(59, 130, 246, 0.5)',
                            transform: 'scale(1.02)',
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
                        'Send Reset Link'
                    )}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ForgotPasswordDialog;