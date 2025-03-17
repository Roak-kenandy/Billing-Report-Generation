import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';

const ForgotPasswordDialog = ({ open, onClose }) => {
  const [email, setEmail] = useState('');

  const handleSubmit = async () => {
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
        alert('Password reset link sent to your email.');
        onClose();
      } else {
        alert(data.message || 'Failed to send reset link.');
      }
    } catch (err) {
      console.error('Error during password reset request:', err);
      alert('An error occurred. Please try again.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Forgot Password</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Email Address"
          type="email"
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} color="primary">
          Send Reset Link
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForgotPasswordDialog;