import axios from 'axios';
import { getToken } from '../utils/auth';

const baseUrl = process.env.REACT_APP_API_URL || 'http://10.10.6.254/billing-reports';

axios.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const uploadFile = async (file) => {
    const formData = new FormData();

    try {
        // Append the file to FormData with the correct field name
        formData.append('file', file);

        const response = await axios.post(
            `${baseUrl}/upload-contacts`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        );

        console.log('Upload successful:', response.data);
        return response.data;

    } catch (error) {
        console.error('Upload failed:', error.response?.data || error.message);
        throw error;
    }
};

const uploadDealerFile = async (file) => {
    const formData = new FormData();

    try {
        // Append the file to FormData with the correct field name
        formData.append('file', file);

        const response = await axios.post(
            `${baseUrl}/upload-dealer-contacts`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        );

        console.log('Upload successful:', response.data);
        return response.data;

    } catch (error) {
        console.error('Upload failed:', error.response?.data || error.message);
        throw error;
    }
};

const createOperationRecord = async (file) => {

    try {

        const response = await axios.post(
            `${baseUrl}/create-bulk`,
            file,
        );

        console.log('Upload successful:', response.data);
        return response.data;

    } catch (error) {
        console.error('Upload failed:', error.response?.data || error.message);
        throw error;
    }
};

const getAllBulkOperations = async (page, limit, type) => {

    try {

        const response = await axios.get(
            `${baseUrl}/get-bulk`, {
            params: { page, limit, type }
        }
        );
        return response.data;

    } catch (error) {
        console.error('Failed to fetch datas:', error.response?.data || error.message);
        throw error;
    }
};

const uploadServiceBulk = async (file) => {
    const formData = new FormData();

    try {
        // Append the file to FormData with the correct field name
        formData.append('file', file);

        const response = await axios.post(
            `${baseUrl}/upload-services`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        );

        console.log('Upload successful:', response.data);
        return response.data;

    } catch (error) {
        console.error('Upload failed:', error.response?.data || error.message);
        throw error;
    }
};

const BULK_REQUEST_TIMEOUT_MS = 90 * 60 * 1000;

const uploadBulkFile = async (endpoint, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${baseUrl}/${endpoint}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        timeout: BULK_REQUEST_TIMEOUT_MS,
        validateStatus: (status) => status >= 200 && status < 300,
    });

    return response.data;
};

const previewCancelSubscriptions = async (file) => uploadBulkFile('upload-cancel-subscriptions-preview', file);

const bulkCancelSubscriptions = async (file) => uploadBulkFile('bulk-cancel-subscriptions', file);

const previewCancelCardSubscriptions = async (file) => uploadBulkFile('upload-cancel-card-subscriptions-preview', file);

const bulkCancelCardSubscriptions = async (file) => uploadBulkFile('bulk-cancel-card-subscriptions', file);

const previewDhiraaguBulkCreation = async (file) => uploadBulkFile('upload-dhiraagu-bulk-preview', file);

const bulkDhiraaguCreation = async (file) => uploadBulkFile('bulk-dhiraagu-creation', file);

const previewBulkAccountTermination = async (file) => uploadBulkFile('bulk-account-termination/preview', file);

const startBulkAccountTermination = async (previewId) => {
    const response = await axios.post(`${baseUrl}/bulk-account-termination/jobs`, { previewId });
    return response.data;
};

const getBulkAccountTerminationJob = async (jobId) => {
    const response = await axios.get(`${baseUrl}/bulk-account-termination/jobs/${jobId}`);
    return response.data;
};

const listBulkAccountTerminationJobs = async () => {
    const response = await axios.get(`${baseUrl}/bulk-account-termination/jobs`);
    return response.data.jobs || [];
};

const stopBulkAccountTerminationJob = async (jobId) => {
    const response = await axios.post(`${baseUrl}/bulk-account-termination/jobs/${jobId}/stop`);
    return response.data;
};

const downloadBulkAccountTerminationCsv = async (path, fileName) => {
    const response = await axios.get(`${baseUrl}/bulk-account-termination/${path}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

export {
    uploadFile,
    createOperationRecord,
    getAllBulkOperations,
    uploadDealerFile,
    uploadServiceBulk,
    previewCancelSubscriptions,
    bulkCancelSubscriptions,
    previewCancelCardSubscriptions,
    bulkCancelCardSubscriptions,
    previewDhiraaguBulkCreation,
    bulkDhiraaguCreation,
    previewBulkAccountTermination,
    startBulkAccountTermination,
    getBulkAccountTerminationJob,
    listBulkAccountTerminationJobs,
    stopBulkAccountTerminationJob,
    downloadBulkAccountTerminationCsv,
};