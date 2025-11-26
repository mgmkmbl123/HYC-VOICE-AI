import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export async function parseFileToText(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return await parsePdf(file);
    case 'docx':
    case 'doc':
      return await parseDocx(file);
    case 'xlsx':
    case 'xls':
      return await parseExcel(file);
    case 'txt':
    case 'md':
    case 'json':
    case 'csv':
      return await parseText(file);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}

async function parseText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str)
      .join(' ');
    fullText += `[Page ${i}]\n${pageText}\n\n`;
  }
  
  return fullText;
}

async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  // Mammoth handles .docx well. For .doc (older binary), it might struggle client-side without more complex libs
  // but we can try basic extraction or warn user. Ideally this is for .docx.
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function parseExcel(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);
  let fullText = '';

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    fullText += `[Sheet: ${sheetName}]\n${csv}\n\n`;
  });

  return fullText;
}
