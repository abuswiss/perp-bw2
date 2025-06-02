// This file redirects to the actual PDF.js worker from CDN
// This helps avoid CORS issues while loading the worker
importScripts('https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js');