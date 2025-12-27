
import * as XLSX from 'xlsx';
import { getTodayJalali } from './dateUtils';

export const exportTableToExcel = (data: any[], fileNamePrefix: string) => {
    try {
        if (!data || data.length === 0) return;

        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // Convert data to worksheet
        const ws = XLSX.utils.json_to_sheet(data);

        // Set RTL direction for the sheet
        if (!ws['!views']) ws['!views'] = [];
        ws['!views'].push({ rightToLeft: true });

        // Append worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, "Data");

        // Generate file name with date
        const dateStr = getTodayJalali().replace(/\//g, '-');
        const fileName = `${fileNamePrefix}_${dateStr}.xlsx`;

        // Write and download
        XLSX.writeFile(wb, fileName);
        return true;
    } catch (error) {
        console.error("Excel Export Failed:", error);
        return false;
    }
};
