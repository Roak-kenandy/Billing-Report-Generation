import React, { useState } from 'react';
import { Container, Typography, TextField, Button, Box, Paper, Grid, Link, Snackbar, Alert } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import ForgotPasswordDialog from '../loginReport/forgotPassword'; // Import the ForgotPasswordDialog

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const LoginReports = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [openForgotPassword, setOpenForgotPassword] = useState(false); // State for Forgot Password Dialog
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch('http://localhost:3000/billing-reports/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Login successful:', data.user);
        localStorage.setItem('token', '5b4f516ae6b5709b5e3a7a540cdaf5b3c8d6f19c0070e38bb8e015be3c66b95b');
        setError('');
        setOpenSnackbar(true);

        setTimeout(() => {
          navigate('/');
        }, 1000);
      } else {
        setError(data.message || 'Login failed');
        setOpenSnackbar(true);
      }
    } catch (err) {
      console.error('Error during login:', err);
      setError('An error occurred. Please try again.');
      setOpenSnackbar(true);
    }
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <Container
        component="main"
        maxWidth="xs"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Paper
          elevation={6}
          sx={{
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            borderRadius: 4,
            boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <LockOutlinedIcon color="primary" sx={{ fontSize: 50, mb: 2 }} />
          <Typography component="h1" variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            Sign in
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, width: '100%' }}>
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
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{
                mt: 2,
                mb: 2,
                backgroundColor: theme.palette.primary.main,
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                },
              }}
            >
              Sign In
            </Button>
            <Grid container justifyContent="space-between">
              <Grid item>
                <Link href="#" variant="body2" sx={{ fontWeight: 'bold' }} onClick={() => setOpenForgotPassword(true)}>
                  Forgot password?
                </Link>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Container>

      {/* Snackbar for showing error/success messages */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={error ? 'error' : 'success'} sx={{ width: '100%' }}>
          {error || 'Login successful!'}
        </Alert>
      </Snackbar>

      {/* Forgot Password Dialog */}
      <ForgotPasswordDialog open={openForgotPassword} onClose={() => setOpenForgotPassword(false)} />
    </ThemeProvider>
  );
};

export default LoginReports;