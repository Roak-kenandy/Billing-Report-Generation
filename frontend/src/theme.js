// theme.js
import { createTheme } from '@mui/material/styles';

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
      fontSize: '1.5rem',
    },
    body2: {
      fontWeight: 500,
      fontSize: '0.875rem',
    },
    body1: {
      fontSize: '0.875rem',
    },
  },
});

export default theme;