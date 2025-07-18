import axios from 'axios';

const baseUrl = 'https://mdnrpt.medianet.mv/billing-reports';

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
            `${baseUrl}/get-bulk`,{
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

export { uploadFile, createOperationRecord, getAllBulkOperations, uploadDealerFile, uploadServiceBulk };