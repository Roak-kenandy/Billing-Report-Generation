import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  Select,
  MenuItem,
  Box,
  Skeleton
} from '@mui/material';
import { CloudUpload, Description, CheckCircle, Autorenew } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { uploadFile, createOperationRecord, getAllBulkOperations } from '../../service/apiService';
const xlsx = require('xlsx');

const BulkUploads = () => {
  const [uploads, setUploads] = useState([]);
  const formatFileInputRef = useRef(null);
  const postingFileInputRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getAllBulkOperations(currentPage, itemsPerPage);
      setUploads(result.data.reports);
      setTotalPages(result.data.totalPages);
      setTotalRecords(result.data.totalRecords);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, itemsPerPage]);

  const handleFormatUpload = async () => {
    const file = formatFileInputRef.current?.files?.[0];
    if (file) {
      try {
        const result = await uploadFile(file);
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = new Uint8Array(e.target.result);
          const workbook = xlsx.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = xlsx.utils.sheet_to_json(worksheet);

          // if (jsonData.length > 100) {
          //   toast.error('Excel file cannot contain more than 100 entries');
          //   formatFileInputRef.current.value = '';
          //   return;
          // }

          const updatedData = jsonData.map((row, index) => ({
            ...row,
            'Contact Code': result.contactIds[index]?.contact_id || row['Contact Code']
          }));

          const newWs = xlsx.utils.json_to_sheet(updatedData);
          const newWb = xlsx.utils.book_new();
          xlsx.utils.book_append_sheet(newWb, newWs, 'Contacts');

          const buffer = xlsx.write(newWb, { type: 'array', bookType: 'xlsx' });
          const blob = new Blob([buffer], { type: 'application/octet-stream' });
          const fileName = `updated_contacts_${Date.now()}.xlsx`;

          const link = document.createElement('a');
          link.href = window.URL.createObjectURL(blob);
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          toast.success('File downloaded successfully!');
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error('Upload error:', error);
        toast.error('An error occurred during the file upload!');
      } finally {
        formatFileInputRef.current.value = '';
      }
    }
  };

  const handlePostingUpload = async () => {
    const file = postingFileInputRef.current?.files?.[0];
    if (!file) return;
  
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = xlsx.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = xlsx.utils.sheet_to_json(worksheet);
  
        // if (jsonData.length > 100) {
        //   toast.error('Excel file cannot contain more than 100 entries');
        //   postingFileInputRef.current.value = '';
        //   return;
        // }
  
        const newRecord = {
          batch: `BATCH${Date.now().toString().slice(-4)}`,
          file_name: file.name,
          date: Math.floor(Date.now() / 1000),
          status: 'running'
        };
  
        setUploads(prev => [...prev, newRecord]);
  
        try {
          const promises = jsonData.map(async (row) => {
            const payload = {
              id: row['Contact Code'],
              action: row.Action || '',
              entity: row.Entity || 'ACCOUNT',
              amount: parseFloat(row.Amount),
              currency_code: row['Currency Code'] || 'MVR',
              notes: row['Notes'] || '',
            };
  
            const response = await fetch(
              `https://app.crm.com/backoffice/v2/contacts/${payload.id}/journals`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'api_key': 'c54504d4-0fbe-41cc-a11e-822710db9b8d',
                },
                body: JSON.stringify(payload),
              }
            );
  
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
          });
  
          await Promise.all(promises);
          await createOperationRecord(newRecord);
  
          setUploads(prev => prev.map(rec =>
            rec.batch === newRecord.batch ? { ...rec, status: 'completed' } : rec
          ));
          
          // Add success toast message
          toast.success('File uploaded and processed successfully!');
  
        } catch (error) {
          console.error('Error processing rows:', error);
          toast.error('Some entries failed to process');
          setUploads(prev => prev.map(rec =>
            rec.batch === newRecord.batch ? { ...rec, status: 'failed' } : rec
          ));
        } finally {
          fetchData();
          postingFileInputRef.current.value = '';
        }
      };
  
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('File processing error:', error);
      toast.error('An error occurred while processing the file');
      postingFileInputRef.current.value = '';
    }
  };

  const formatDate = (unixTimestamp) => {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <Box
      sx={{
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 37px)',
        overflow: 'hidden',
        background: '#f9fafb',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
          mb: 3,
          p: 2,
          backgroundColor: '#ffffff',
          borderRadius: 2,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e3a8a' }}>
          Bulk Operations
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            component="label"
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={handleFormatUpload}
            sx={{
              height: 48,
              borderRadius: 2,
              backgroundColor: '#22c55e',
              textTransform: 'none',
              fontWeight: 500,
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: '#16a34a',
                transform: 'translateY(-2px)',
              },
            }}
          >
            Format CSV
            <input
              type="file"
              hidden
              ref={formatFileInputRef}
              onChange={handleFormatUpload}
            />
          </Button>
          <Button
            component="label"
            variant="contained"
            startIcon={<Description />}
            onClick={handlePostingUpload}
            sx={{
              height: 48,
              borderRadius: 2,
              backgroundColor: '#22c55e',
              textTransform: 'none',
              fontWeight: 500,
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: '#16a34a',
                transform: 'translateY(-2px)',
              },
            }}
          >
            Post CSV
            <input
              type="file"
              hidden
              ref={postingFileInputRef}
              onChange={handlePostingUpload}
            />
          </Button>
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          backgroundColor: '#ffffff',
        }}
      >
        <TableContainer
          sx={{
            height: '100%',
            overflow: 'auto',
            borderRadius: 2,
            '&::-webkit-scrollbar': {
              height: 6,
              width: 6,
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#94a3b8',
              borderRadius: 3,
            },
          }}
        >
          <Table stickyHeader sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                {['Batch #', 'Filename', 'Date', 'Status'].map((header) => (
                  <TableCell
                    key={header}
                    sx={{
                      fontWeight: 600,
                      background: 'linear-gradient(90deg, #1e3a8a, #1e40af)',
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                      py: 1.5,
                      px: 2,
                      borderBottom: 'none',
                    }}
                  >
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: 4 }).map((_, cellIndex) => (
                      <TableCell key={cellIndex} sx={{ py: 2 }}>
                        <Skeleton variant="text" animation="wave" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                uploads.map((upload) => (
                  <TableRow
                    key={upload.batch}
                    hover
                    sx={{
                      '&:last-child td': { borderBottom: 0 },
                      transition: 'background-color 0.2s ease',
                      '&:hover': { backgroundColor: '#f1f5f9' },
                    }}
                  >
                    <TableCell sx={{ color: '#475569', py: 2, px: 2 }}>{upload.batch}</TableCell>
                    <TableCell sx={{ color: '#475569', py: 2, px: 2 }}>{upload.file_name}</TableCell>
                    <TableCell sx={{ color: '#475569', py: 2, px: 2 }}>{formatDate(upload.date)}</TableCell>
                    <TableCell sx={{ color: '#475569', py: 2, px: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {upload.status === 'running' ? (
                          <Autorenew sx={{ color: '#1e3a8a' }} />
                        ) : (
                          <CheckCircle sx={{ color: '#22c55e' }} />
                        )}
                        {upload.status}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          mt: 3,
          pb: 2,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        {/* <Typography variant="body2" sx={{ color: '#475569' }}>
          Showing {(currentPage - 1) * itemsPerPage + 1} - 
          {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords}
        </Typography> */}
        <Pagination
          count={totalPages}
          page={currentPage}
          onChange={(e, page) => setCurrentPage(page)}
          color="primary"
          showFirstButton
          showLastButton
          sx={{
            '& .MuiPaginationItem-root': {
              fontSize: '0.875rem',
              borderRadius: 1,
              transition: 'all 0.3s ease',
              '&:hover': { backgroundColor: '#e2e8f0' },
            },
            '& .Mui-selected': {
              backgroundColor: '#3b82f6 !important',
              color: '#ffffff',
            },
          }}
        />
        {/* <Select
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
          sx={{
            height: 40,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1e3a8a' },
          }}
        >
          <MenuItem value={10}>10 per page</MenuItem>
          <MenuItem value={25}>25 per page</MenuItem>
          <MenuItem value={50}>50 per page</MenuItem>
        </Select> */}
      </Box>
    </Box>
  );
};

export default BulkUploads;