import { useState } from 'react';
import { Download, Copy, Save, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface DocumentActionsProps {
  content: string;
  title?: string;
  onSave?: (content: string, title: string) => void;
}

const DocumentActions = ({ content, title = 'Legal Document', onSave }: DocumentActionsProps) => {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const downloadAsText = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsPDF = () => {
    try {
      const pdf = new jsPDF();
      
      // Set up margins and page dimensions
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      
      // Split content into lines that fit the page width
      const lines = pdf.splitTextToSize(content, maxWidth);
      
      // Add title
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin, 30);
      
      // Add content
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      
      let yPosition = 50;
      const lineHeight = 7;
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      lines.forEach((line: string) => {
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(line, margin, yPosition);
        yPosition += lineHeight;
      });
      
      pdf.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      // Fallback to text download
      downloadAsText();
    }
  };

  const downloadAsWord = () => {
    // Create a simple RTF document that can be opened by Word
    const rtfContent = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}
\\f0\\fs24 ${content.replace(/\n/g, '\\par ')}
}`;
    
    const blob = new Blob([rtfContent], { type: 'application/rtf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.rtf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title,
          content: content,
          documentType: 'brief',
          matterId: null // TODO: Get from context if available
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save document');
      }

      const result = await response.json();
      console.log('Document saved:', result);
      
      // Show success message
      alert('Document saved to library successfully!');
      
      if (onSave) {
        await onSave(content, title);
      }
    } catch (error) {
      console.error('Failed to save document:', error);
      alert('Failed to save document. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-light-100 dark:bg-dark-100 rounded-lg p-4 mt-4 border border-light-200 dark:border-dark-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <FileText size={20} className="text-[#24A0ED]" />
          <h3 className="text-sm font-medium text-black dark:text-white">Document Actions</h3>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <button
          onClick={copyToClipboard}
          className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-dark-200 hover:bg-light-200 dark:hover:bg-dark-300 rounded-md text-sm transition-colors border border-light-300 dark:border-dark-300"
        >
          <Copy size={16} />
          <span>{copied ? 'Copied!' : 'Copy Text'}</span>
        </button>
        
        <button
          onClick={downloadAsPDF}
          className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-dark-200 hover:bg-light-200 dark:hover:bg-dark-300 rounded-md text-sm transition-colors border border-light-300 dark:border-dark-300"
        >
          <Download size={16} />
          <span>Download PDF</span>
        </button>
        
        <button
          onClick={downloadAsWord}
          className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-dark-200 hover:bg-light-200 dark:hover:bg-dark-300 rounded-md text-sm transition-colors border border-light-300 dark:border-dark-300"
        >
          <Download size={16} />
          <span>Download Word</span>
        </button>
        
        <button
          onClick={downloadAsText}
          className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-dark-200 hover:bg-light-200 dark:hover:bg-dark-300 rounded-md text-sm transition-colors border border-light-300 dark:border-dark-300"
        >
          <Download size={16} />
          <span>Download Text</span>
        </button>
        
        {onSave && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-3 py-2 bg-[#24A0ED] hover:bg-[#1e8fd4] text-white rounded-md text-sm transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save to Library'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DocumentActions;