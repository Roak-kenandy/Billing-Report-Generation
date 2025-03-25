import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Select,
    MenuItem,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    CircularProgress,
    Alert,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';

const RbacPermissions = () => {
    const [users, setUsers] = useState([]);
    const [newPermission, setNewPermission] = useState('');
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('http://localhost:3003/billing-reports/users');
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPermission = async (userId) => {
        if (!newPermission) return;
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:3003/billing-reports/users/${userId}/permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions: newPermission }), // Send single permission
            });
            if (!response.ok) throw new Error('Failed to add permission');
            setNewPermission('');
            setSelectedUserId(null);
            fetchUsers();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (id) => {
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:3003/billing-reports/users/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete user');
            fetchUsers();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 'bold', color: '#1e3a8a' }}>
                RBAC Permissions Management
            </Typography>

            {loading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 2 }} />}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <TableContainer component={Paper} elevation={3}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#1e3a8a' }}>
                            <TableCell sx={{ color: '#ffffff', fontWeight: 'bold' }}>Name</TableCell>
                            <TableCell sx={{ color: '#ffffff', fontWeight: 'bold' }}>Email</TableCell>
                            <TableCell sx={{ color: '#ffffff', fontWeight: 'bold' }}>Permission</TableCell>
                            <TableCell sx={{ color: '#ffffff', fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map(user => (
                            <TableRow key={user._id} sx={{ '&:hover': { backgroundColor: '#f5f5f5' } }}>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.permissions || 'None'}</TableCell>
                                <TableCell>
                                    <IconButton
                                        onClick={() => setSelectedUserId(user._id === selectedUserId ? null : user._id)}
                                        color="primary"
                                    >
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton onClick={() => handleDeleteUser(user._id)} color="error">
                                        <DeleteIcon />
                                    </IconButton>
                                    {selectedUserId === user._id && (
                                        <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center' }}>
                                            <Select
                                                size="small"
                                                value={newPermission}
                                                onChange={(e) => setNewPermission(e.target.value)}
                                                displayEmpty
                                                sx={{ minWidth: 150 }}
                                            >
                                                <MenuItem value="" disabled>Select Permission</MenuItem>
                                                <MenuItem value="View">View</MenuItem>
                                                <MenuItem value="Not view">Not view</MenuItem>
                                            </Select>
                                            <Button
                                                variant="contained"
                                                onClick={() => handleAddPermission(user._id)}
                                                disabled={loading || !newPermission}
                                                sx={{ backgroundColor: '#1e40af', '&:hover': { backgroundColor: '#1e3a8a' } }}
                                            >
                                                Update Permission
                                            </Button>
                                        </Box>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default RbacPermissions;