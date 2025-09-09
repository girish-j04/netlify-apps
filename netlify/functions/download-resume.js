// netlify/functions/download-resume.js
import { PDFDocument, StandardFonts } from 'pdf-lib';

export const handler = async (event) => {
  try{
    const { text } = JSON.parse(event.body||'{}');
    if(!text) return { statusCode:400, body:'missing text' };
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]); // Letter
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;

    // wrap text into lines roughly within 7.0in width
    const maxWidth = 540;
    const lines = wrap(text, font, fontSize, maxWidth);
    let y = 760;
    const lineHeight = 14;
    for(const line of lines){
      if(y < 40){ pdf.addPage([612,792]); y = 760; }
      page.drawText(line, { x:36, y, size: fontSize, font, color: undefined });
      y -= lineHeight;
    }
    const bytes = await pdf.save();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="tailored-resume.pdf"'
      },
      body: Buffer.from(bytes).toString('base64'),
      isBase64Encoded: true
    };
  }catch(err){
    console.error(err); return { statusCode:500, body:'pdf failed' };
  }
};

function wrap(text, font, size, max){
  const words = text.replace(/\r/g,'').split(/\n|\s+/).filter(Boolean);
  const lines = []; let line = '';
  for(const w of words){
    const test = line ? line + ' ' + w : w;
    const width = font.widthOfTextAtSize(test, size);
    if(width > max){ lines.push(line); line = w; } else { line = test; }
  }
  if(line) lines.push(line);
  return lines;
}