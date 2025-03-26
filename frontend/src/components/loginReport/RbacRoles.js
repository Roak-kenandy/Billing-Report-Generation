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
    Modal,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';

const RbacRoles = () => {
    const [users, setUsers] = useState([]);
    const [newRole, setNewRole] = useState('');
    const [roleToRemove, setRoleToRemove] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [openModal, setOpenModal] = useState(false);

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

    const handleAddRole = async () => {
        if (!newRole || !selectedUser) return;
        setLoading(true);
        try {
            const updatedRoles = [...new Set([...selectedUser.roles, newRole])]; // Avoid duplicates
            const response = await fetch(`https://mdnrpt.medianet.mv/billing-reports/users/${selectedUser._id}/roles`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roles: updatedRoles }),
            });
            if (!response.ok) throw new Error('Failed to add role');
            setNewRole('');
            fetchUsers();
            setOpenModal(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveRole = async () => {
        if (!roleToRemove || !selectedUser) return;
        setLoading(true);
        try {
            const updatedRoles = selectedUser.roles.filter(role => role !== roleToRemove);
            const response = await fetch(`https://mdnrpt.medianet.mv/billing-reports/users/${selectedUser._id}/roles`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roles: updatedRoles }),
            });
            if (!response.ok) throw new Error('Failed to remove role');
            setRoleToRemove('');
            fetchUsers();
            setOpenModal(false);
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

    const handleOpenModal = (user) => {
        setSelectedUser(user);
        setNewRole('');
        setRoleToRemove('');
        setOpenModal(true);
    };

    const handleCloseModal = () => {
        setOpenModal(false);
        setSelectedUser(null);
    };

    return (
        <Box sx={{ p: 4, backgroundColor: '#f9fafb', minHeight: '100vh', overflow: 'hidden' }}>
            <Typography
                variant="h4"
                gutterBottom
                sx={{ mb: 4, fontWeight: '600', color: '#111827', textAlign: 'center' }}
            >
                Role-Based Access Control (RBAC)
            </Typography>

            {loading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 2 }} />}
            {error && <Alert severity="error" sx={{ mb: 3, maxWidth: '600px', mx: 'auto' }}>{error}</Alert>}

            <TableContainer
                component={Paper}
                sx={{
                    maxWidth: '900px',
                    mx: 'auto',
                    borderRadius: '8px',
                    boxShadow: 3,
                    maxHeight: '400px', // Fixed height for the table
                    overflowY: 'auto', // Enable vertical scrolling
                }}
            >
                <Table stickyHeader> {/* stickyHeader keeps the header fixed */}
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#2563eb' }}>
                            <TableCell sx={{ color: '#fff', fontWeight: '600', backgroundColor: '#2563eb' }}>
                                Name
                            </TableCell>
                            <TableCell sx={{ color: '#fff', fontWeight: '600', backgroundColor: '#2563eb' }}>
                                Email
                            </TableCell>
                            <TableCell sx={{ color: '#fff', fontWeight: '600', backgroundColor: '#2563eb' }}>
                                Roles
                            </TableCell>
                            <TableCell sx={{ color: '#fff', fontWeight: '600', backgroundColor: '#2563eb' }}>
                                Actions
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map(user => (
                            <TableRow key={user._id} sx={{ '&:hover': { backgroundColor: '#f1f5f9' } }}>
                                <TableCell sx={{ color: '#374151' }}>{user.name}</TableCell>
                                <TableCell sx={{ color: '#374151' }}>{user.email}</TableCell>
                                <TableCell sx={{ color: '#374151' }}>{user.roles.join(', ') || 'None'}</TableCell>
                                <TableCell>
                                    <IconButton onClick={() => handleOpenModal(user)} color="primary">
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton onClick={() => handleDeleteUser(user._id)} color="error">
                                        <DeleteIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Edit Roles Modal */}
            <Modal open={openModal} onClose={handleCloseModal}>
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 400,
                        bgcolor: 'white',
                        borderRadius: '8px',
                        boxShadow: 24,
                        p: 4,
                    }}
                >
                    <Typography variant="h6" sx={{ mb: 3, fontWeight: '600', color: '#111827' }}>
                        Edit Roles for {selectedUser?.name}
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* Add Role */}
                        <Box>
                            <Typography sx={{ mb: 1, color: '#374151' }}>Add New Role</Typography>
                            <Select
                                fullWidth
                                size="small"
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value)}
                                displayEmpty
                            >
                                <MenuItem value="" disabled>Select Role</MenuItem>
                                <MenuItem value="Finance">Finance</MenuItem>
                                <MenuItem value="Sales">Sales</MenuItem>
                                <MenuItem value="Admin">Admin</MenuItem>
                            </Select>
                            <Button
                                variant="contained"
                                onClick={handleAddRole}
                                disabled={loading || !newRole}
                                sx={{ mt: 2, backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' } }}
                            >
                                Add Role
                            </Button>
                        </Box>

                        {/* Remove Role */}
                        {selectedUser?.roles.length > 0 && (
                            <Box>
                                <Typography sx={{ mb: 1, color: '#374151' }}>Remove Role</Typography>
                                <Select
                                    fullWidth
                                    size="small"
                                    value={roleToRemove}
                                    onChange={(e) => setRoleToRemove(e.target.value)}
                                    displayEmpty
                                >
                                    <MenuItem value="" disabled>Select Role</MenuItem>
                                    {selectedUser?.roles.map(role => (
                                        <MenuItem key={role} value={role}>
                                            {role}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={handleRemoveRole}
                                    disabled={loading || !roleToRemove}
                                    sx={{ mt: 2 }}
                                >
                                    Remove Role
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Modal>
        </Box>
    );
};

export default RbacRoles;