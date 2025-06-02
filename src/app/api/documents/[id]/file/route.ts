import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Try to load original file from uploads directory
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    // Check for PDF file
    const pdfPath = path.join(uploadDir, `${id}.pdf`);
    if (fs.existsSync(pdfPath)) {
      const fileBuffer = fs.readFileSync(pdfPath);
      const filename = `${id}.pdf`;
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }

    // Check for DOCX file
    const docxPath = path.join(uploadDir, `${id}.docx`);
    if (fs.existsSync(docxPath)) {
      const fileBuffer = fs.readFileSync(docxPath);
      const filename = `${id}.docx`;
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }

    // Check for TXT file
    const txtPath = path.join(uploadDir, `${id}.txt`);
    if (fs.existsSync(txtPath)) {
      const fileBuffer = fs.readFileSync(txtPath);
      const filename = `${id}.txt`;
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }

    // Try to get file info from extracted metadata
    const extractedPath = path.join(uploadDir, `${id}-extracted.json`);
    if (fs.existsSync(extractedPath)) {
      const extractedContent = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));
      const originalFilename = extractedContent.title || extractedContent.metadata?.filename || 'unknown';
      
      // Try to find file with original extension
      const extension = path.extname(originalFilename).toLowerCase();
      const filePath = path.join(uploadDir, `${id}${extension}`);
      
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        
        // Set appropriate content type based on extension
        let contentType = 'application/octet-stream';
        let disposition = 'attachment';
        
        switch (extension) {
          case '.pdf':
            contentType = 'application/pdf';
            disposition = 'inline';
            break;
          case '.docx':
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            break;
          case '.txt':
            contentType = 'text/plain';
            disposition = 'inline';
            break;
        }
        
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `${disposition}; filename="${originalFilename}"`,
            'Cache-Control': 'public, max-age=31536000',
          },
        });
      }
    }

    // Fallback: Try to find any file with the ID as prefix
    try {
      const files = fs.readdirSync(uploadDir).filter(f => f.startsWith(id) && !f.includes('-extracted') && !f.includes('-embeddings'));
      
      if (files.length > 0) {
        const filePath = path.join(uploadDir, files[0]);
        const fileBuffer = fs.readFileSync(filePath);
        const extension = path.extname(files[0]).toLowerCase();
        
        let contentType = 'application/octet-stream';
        let disposition = 'attachment';
        
        switch (extension) {
          case '.pdf':
            contentType = 'application/pdf';
            disposition = 'inline';
            break;
          case '.docx':
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            break;
          case '.txt':
            contentType = 'text/plain';
            disposition = 'inline';
            break;
        }
        
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `${disposition}; filename="${files[0]}"`,
            'Cache-Control': 'public, max-age=31536000',
          },
        });
      }
    } catch (error) {
      console.error('Error reading directory:', error);
    }

    return NextResponse.json({ error: 'File not found' }, { status: 404 });

  } catch (error) {
    console.error('Error serving document file:', error);
    return NextResponse.json(
      { error: 'Failed to serve document file' },
      { status: 500 }
    );
  }
}