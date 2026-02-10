import { getTodayJalali } from './dateUtils';

export const exportTableToExcel = async (data: any[], fileNamePrefix: string): Promise<boolean> => {
    try {
        if (!data || data.length === 0) return false;

        // Dynamically import ExcelJS only when needed
        const ExcelJS = (await import('exceljs')).default;

        // Create a new workbook
        const workbook = new ExcelJS.Workbook();

        // Add worksheet with RTL direction
        const worksheet = workbook.addWorksheet('Data', {
            views: [{ rightToLeft: true }]
        });

        // Get headers from first data object
        const headers = Object.keys(data[0]);

        // Add header row
        worksheet.columns = headers.map(header => ({
            header: header,
            key: header,
            width: 20
        }));

        // Add data rows with global styling
        data.forEach(row => {
            const addedRow = worksheet.addRow(row);
            addedRow.eachCell((cell, colNumber) => {
                const header = headers[colNumber - 1];
                const isPlate = header && header.includes('پلاک');

                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle',
                    readingOrder: isPlate ? 'ltr' : undefined
                };
            });
        });

        // Style header row (Blue background, White bold text)
        const headerRow = worksheet.getRow(1);
        headerRow.height = 25;
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF2563EB' }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Generate file name with date
        const dateStr = getTodayJalali().replace(/\//g, '-');
        const fileName = `${fileNamePrefix}_${dateStr}.xlsx`;

        // Generate buffer and download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        return true;
    } catch (error) {
        console.error("Excel Export Failed:", error);
        return false;
    }
};
