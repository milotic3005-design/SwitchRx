// Basic PHI sanitization using regex. In a real app, use a robust NLP-based de-identification service.
export function sanitizePHI(text: string): string {
  let sanitized = text;
  
  // Remove potential names (very basic, prone to false positives/negatives)
  // Remove dates (DOB, admission dates)
  sanitized = sanitized.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, '[DATE]');
  
  // Remove SSNs
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
  
  // Remove Phone Numbers
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
  
  // Remove MRNs (assuming a specific format, e.g., 7-9 digits)
  sanitized = sanitized.replace(/\bMRN\s*#?\s*\d{7,9}\b/gi, '[MRN]');

  return sanitized;
}
