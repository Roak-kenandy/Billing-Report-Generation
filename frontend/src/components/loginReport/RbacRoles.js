import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    MenuItem,
    Pagination,
    Paper,
    Select,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, PersonAdd, Search } from '@mui/icons-material';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/auth';

const PAGE_SIZE = 8;
const ROLES = ['Finance', 'Sales', 'Admin', 'HDC', 'Service Provider'];

const roleColor = (role) => {
    if (role === 'Admin') return 'error';
    if (role === 'Finance') return 'primary';
    if (role === 'Sales') return 'success';
    if (role === 'HDC') return 'warning';
    return 'default';
};

const buildRole = (role, provider, island) => {
    if (role !== 'Service Provider') return role;
    return `Service Provider: ${provider}${island ? `, Island: ${island}` : ''}`;
};

const RbacRoles = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const [addOpen, setAddOpen] = useState(false);
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userPassword, setUserPassword] = useState('');
    const [userRole, setUserRole] = useState('Finance');
    const [newServiceProvider, setNewServiceProvider] = useState('');
    const [newIsland, setNewIsland] = useState('');

    const [editUser, setEditUser] = useState(null);
    const [newRole, setNewRole] = useState('');
    const [serviceProviderName, setServiceProviderName] = useState('');
    const [islandName, setIslandName] = useState('');
    const [deleteUser, setDeleteUser] = useState(null);

    const API_URL = getApiBaseUrl().replace(/\/billing-reports$/, '');

    const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/billing-reports/users`, { headers: getAuthHeaders() });
            const data = await response.json().catch(() => []);
            if (!response.ok) throw new Error(data.message || 'Failed to fetch users');
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return users;
        return users.filter((user) => {
            const roles = (user.roles || []).join(' ').toLowerCase();
            return (
                String(user.name || '').toLowerCase().includes(term)
                || String(user.email || '').toLowerCase().includes(term)
                || roles.includes(term)
            );
        });
    }, [users, search]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount);
    const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const resetAddForm = () => {
        setUserName('');
        setUserEmail('');
        setUserPassword('');
        setUserRole('Finance');
        setNewServiceProvider('');
        setNewIsland('');
    };

    const handleCreateUser = async () => {
        if (!userName.trim() || !userEmail.trim() || !userPassword) {
            setError('Name, email, and password are required.');
            return;
        }
        if (userRole === 'Service Provider' && !newServiceProvider.trim()) {
            setError('Service provider name is required.');
            return;
        }
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const response = await fetch(`${API_URL}/billing-reports/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    name: userName.trim(),
                    email: userEmail.trim(),
                    password: userPassword,
                    roles: [buildRole(userRole, newServiceProvider.trim(), newIsland.trim())],
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Failed to add user');
            resetAddForm();
            setAddOpen(false);
            setSuccess(`${data.name || 'User'} can now log in with the email you entered.`);
            setPage(1);
            fetchUsers();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const saveRoles = async (roles) => {
        const response = await fetch(`${API_URL}/billing-reports/users/${editUser._id}/roles`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ roles }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Failed to update roles');
        setEditUser({ ...editUser, roles });
        fetchUsers();
    };

    const handleAddRole = async () => {
        if (!newRole || !editUser) return;
        if (newRole === 'Service Provider' && !serviceProviderName.trim()) return;
        setSaving(true);
        setError('');
        try {
            const roleToAdd = buildRole(newRole, serviceProviderName.trim(), islandName.trim());
            await saveRoles([...new Set([...(editUser.roles || []), roleToAdd])]);
            setNewRole('');
            setServiceProviderName('');
            setIslandName('');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveRole = async (role) => {
        setSaving(true);
        setError('');
        try {
            await saveRoles((editUser.roles || []).filter((item) => item !== role));
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!deleteUser) return;
        setSaving(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/billing-reports/users/${deleteUser._id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Failed to delete user');
            setDeleteUser(null);
            setSuccess('User removed.');
            fetchUsers();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                <Box>
                    <Typography variant="h5">Users and roles</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {filtered.length} user{filtered.length === 1 ? '' : 's'}
                        {search.trim() ? ` matching “${search.trim()}”` : ''}
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<PersonAdd />} onClick={() => { setError(''); setAddOpen(true); }}>
                    Add user
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            <Paper sx={{ p: 2, mb: 2 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Search by name, email, or role"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                />
            </Paper>

            <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            {['Name', 'Email', 'Roles', ''].map((header) => (
                                <TableCell
                                    key={header || 'actions'}
                                    sx={{ fontWeight: 600, color: '#fff', background: 'linear-gradient(90deg, #1e3a8a, #1e40af)' }}
                                >
                                    {header}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            [...Array(PAGE_SIZE)].map((_, index) => (
                                <TableRow key={index}>
                                    {[0, 1, 2, 3].map((cell) => (
                                        <TableCell key={cell}><Skeleton /></TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : visible.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                                    {search.trim() ? 'No users match that search.' : 'No users yet. Add the first one.'}
                                </TableCell>
                            </TableRow>
                        ) : visible.map((user) => (
                            <TableRow key={user._id} hover>
                                <TableCell>{user.name || '—'}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {(user.roles || []).length === 0
                                            ? <Typography variant="body2" color="text.secondary">No role</Typography>
                                            : (user.roles || []).map((role) => (
                                                <Chip key={role} size="small" label={role} color={roleColor(role)} variant="outlined" />
                                            ))}
                                    </Box>
                                </TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                    <IconButton aria-label="Edit roles" onClick={() => { setEditUser(user); setNewRole(''); }}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton aria-label="Delete user" color="error" onClick={() => setDeleteUser(user)}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 2 }}>
                <Pagination
                    count={pageCount}
                    page={safePage}
                    onChange={(_, value) => setPage(value)}
                    color="primary"
                    showFirstButton
                    showLastButton
                />
            </Box>

            <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Add user</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField label="Name" value={userName} onChange={(e) => setUserName(e.target.value)} fullWidth margin="dense" />
                    <TextField label="Email" type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} fullWidth />
                    <TextField label="Password" type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} helperText="At least 8 characters" fullWidth />
                    <Select value={userRole} onChange={(e) => setUserRole(e.target.value)} fullWidth>
                        {ROLES.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
                    </Select>
                    {userRole === 'Service Provider' && (
                        <>
                            <TextField label="Service provider name" value={newServiceProvider} onChange={(e) => setNewServiceProvider(e.target.value)} fullWidth />
                            <TextField label="Island (optional)" value={newIsland} onChange={(e) => setNewIsland(e.target.value)} fullWidth />
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setAddOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateUser} disabled={saving}>Save user</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(editUser)} onClose={() => setEditUser(null)} fullWidth maxWidth="sm">
                <DialogTitle>Roles for {editUser?.name || editUser?.email}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{editUser?.email}</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                        {(editUser?.roles || []).length === 0 && (
                            <Typography variant="body2" color="text.secondary">No roles assigned.</Typography>
                        )}
                        {(editUser?.roles || []).map((role) => (
                            <Chip key={role} label={role} onDelete={() => handleRemoveRole(role)} color={roleColor(role)} variant="outlined" />
                        ))}
                    </Box>
                    <Select fullWidth size="small" displayEmpty value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                        <MenuItem value="">Select a role to add</MenuItem>
                        {ROLES.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
                    </Select>
                    {newRole === 'Service Provider' && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                            <TextField size="small" label="Service provider name" value={serviceProviderName} onChange={(e) => setServiceProviderName(e.target.value)} />
                            <TextField size="small" label="Island (optional)" value={islandName} onChange={(e) => setIslandName(e.target.value)} />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setEditUser(null)}>Close</Button>
                    <Button
                        variant="contained"
                        onClick={handleAddRole}
                        disabled={saving || !newRole || (newRole === 'Service Provider' && !serviceProviderName.trim())}
                    >
                        Add role
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(deleteUser)} onClose={() => setDeleteUser(null)}>
                <DialogTitle>Remove user</DialogTitle>
                <DialogContent>
                    <Typography>
                        Remove {deleteUser?.name || deleteUser?.email}? They will no longer be able to log in.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteUser(null)}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={handleDeleteUser} disabled={saving}>Remove</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default RbacRoles;
