"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExcel = generateExcel;
const exceljs_1 = __importDefault(require("exceljs"));
async function generateExcel(matrix) {
    const workbook = new exceljs_1.default.Workbook();
    const worksheet = workbook.addWorksheet('Extracted Table');
    // Freeze the first row so headers stay visible when scrolling
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    if (matrix.length === 0) {
        return (await workbook.xlsx.writeBuffer());
    }
    // Helper to parse numbers and currencies
    const parseCellContent = (text) => {
        const cleanText = text.trim();
        if (!cleanText) {
            return { value: '' };
        }
        // Check if it looks like a currency (e.g. $1,234.56 or -$100)
        const currencyRegex = /^\s*(-)?\$?\s*([0-9,]+(\.[0-9]+)?)\s*$/;
        const currencyMatch = cleanText.match(currencyRegex);
        if (currencyMatch) {
            const isNegative = !!currencyMatch[1];
            const numericPart = currencyMatch[2].replace(/,/g, '');
            const numVal = parseFloat(numericPart);
            if (!isNaN(numVal)) {
                return {
                    value: isNegative ? -numVal : numVal,
                    format: '$#,##0.00'
                };
            }
        }
        // Check if it is a plain number
        const numericRegex = /^\s*(-)?\s*([0-9,]+(\.[0-9]+)?)\s*$/;
        const numericMatch = cleanText.match(numericRegex);
        if (numericMatch) {
            const isNegative = !!numericMatch[1];
            const numericPart = numericMatch[2].replace(/,/g, '');
            const numVal = parseFloat(numericPart);
            if (!isNaN(numVal)) {
                // Integer or float formatting
                const hasDecimals = numericPart.includes('.');
                return {
                    value: isNegative ? -numVal : numVal,
                    format: hasDecimals ? '0.00' : '0'
                };
            }
        }
        // Return as plain text
        return { value: cleanText };
    };
    // Add rows to spreadsheet
    matrix.forEach((row, rowIdx) => {
        const rowValues = row.map(cell => {
            const parsed = parseCellContent(cell.text);
            return parsed.value;
        });
        const excelRow = worksheet.addRow(rowValues);
        // Apply styling cell-by-cell
        row.forEach((cellData, colIdx) => {
            const excelCell = excelRow.getCell(colIdx + 1);
            const parsed = parseCellContent(cellData.text);
            // Re-apply specific formatting for numbers/currencies
            if (parsed.format) {
                excelCell.numFmt = parsed.format;
            }
            // Base border style
            excelCell.border = {
                top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
            };
            // Set alignment based on value type
            if (typeof parsed.value === 'number') {
                excelCell.alignment = { vertical: 'middle', horizontal: 'right' };
            }
            else {
                excelCell.alignment = { vertical: 'middle', horizontal: 'left' };
            }
            // Design Header style vs Data row style
            const isHeader = cellData.isHeader || rowIdx === 0;
            if (isHeader) {
                excelCell.font = {
                    name: 'Segoe UI',
                    size: 11,
                    bold: true,
                    color: { argb: 'FFFFFFFF' } // White text
                };
                excelCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1E3A8A' } // Dark Cobalt Blue
                };
                excelCell.alignment = { vertical: 'middle', horizontal: 'center' };
            }
            else {
                excelCell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    color: { argb: 'FF333333' }
                };
            }
        });
        // Set row height
        excelRow.height = rowIdx === 0 ? 26 : 20;
    });
    // Calculate auto-fit columns
    worksheet.columns.forEach(column => {
        let maxLength = 10;
        if (column.eachCell) {
            column.eachCell({ includeEmpty: true }, cell => {
                const valueStr = cell.value ? String(cell.value) : '';
                if (valueStr.length > maxLength) {
                    maxLength = valueStr.length;
                }
            });
        }
        column.width = maxLength + 4; // Add padding
    });
    return (await workbook.xlsx.writeBuffer());
}
