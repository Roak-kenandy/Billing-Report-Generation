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

const RbacRoles = () => {
    const [users, setUsers] = useState([]);
    const [newRole, setNewRole] = useState('');
    const [roleToRemove, setRoleToRemove] = useState(''); // State for role to remove
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
            const response = await fetch('https://mdnrpt.medianet.mv/billing-reports/users');
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRole = async (userId) => {
        if (!newRole) return;
        setLoading(true);
        try {
            const user = users.find(u => u._id === userId);
            const updatedRoles = [...new Set([...user.roles, newRole])]; // Avoid duplicates
            const response = await fetch(`https://mdnrpt.medianet.mv/billing-reports/users/${userId}/roles`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roles: updatedRoles }),
            });
            if (!response.ok) throw new Error('Failed to add role');
            setNewRole('');
            setSelectedUserId(null);
            fetchUsers();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveRole = async (userId) => {
        if (!roleToRemove) return;
        setLoading(true);
        try {
            const user = users.find(u => u._id === userId);
            const updatedRoles = user.roles.filter(role => role !== roleToRemove); // Remove the selected role
            const response = await fetch(`https://mdnrpt.medianet.mv/billing-reports/users/${userId}/roles`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roles: updatedRoles }),
            });
            if (!response.ok) throw new Error('Failed to remove role');
            setRoleToRemove('');
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
            const response = await fetch(`https://mdnrpt.medianet.mv/billing-reports/users/${id}`, {
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
                RBAC Roles Management
            </Typography>

            {loading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 2 }} />}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <TableContainer component={Paper} elevation={3}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#1e3a8a' }}>
                            <TableCell sx={{ color: '#ffffff', fontWeight: 'bold' }}>Name</TableCell>
                            <TableCell sx={{ color: '#ffffff', fontWeight: 'bold' }}>Email</TableCell>
                            <TableCell sx={{ color: '#ffffff', fontWeight: 'bold' }}>Roles</TableCell>
                            <TableCell sx={{ color: '#ffffff', fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map(user => (
                            <TableRow key={user._id} sx={{ '&:hover': { backgroundColor: '#f5f5f5' } }}>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.roles.join(', ') || 'None'}</TableCell>
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
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                                            {/* Add Role Section */}
                                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                                <Select
                                                    size="small"
                                                    value={newRole}
                                                    onChange={(e) => setNewRole(e.target.value)}
                                                    displayEmpty
                                                    sx={{ minWidth: 150 }}
                                                >
                                                    <MenuItem value="" disabled>Select Role to Add</MenuItem>
                                                    <MenuItem value="Finance">Finance</MenuItem>
                                                    <MenuItem value="Sales">Sales</MenuItem>
                                                    <MenuItem value="Admin">Admin</MenuItem>
                                                </Select>
                                                <Button
                                                    variant="contained"
                                                    onClick={() => handleAddRole(user._id)}
                                                    disabled={loading || !newRole}
                                                    sx={{ backgroundColor: '#1e40af', '&:hover': { backgroundColor: '#1e3a8a' } }}
                                                >
                                                    Add Role
                                                </Button>
                                            </Box>

                                            {/* Remove Role Section */}
                                            {user.roles.length > 0 && (
                                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                                    <Select
                                                        size="small"
                                                        value={roleToRemove}
                                                        onChange={(e) => setRoleToRemove(e.target.value)}
                                                        displayEmpty
                                                        sx={{ minWidth: 150 }}
                                                    >
                                                        <MenuItem value="" disabled>Select Role to Remove</MenuItem>
                                                        {user.roles.map(role => (
                                                            <MenuItem key={role} value={role}>
                                                                {role}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                    <Button
                                                        variant="contained"
                                                        color="error"
                                                        onClick={() => handleRemoveRole(user._id)}
                                                        disabled={loading || !roleToRemove}
                                                    >
                                                        Remove Role
                                                    </Button>
                                                </Box>
                                            )}
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

export default RbacRoles;