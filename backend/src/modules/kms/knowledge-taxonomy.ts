export type KnowledgeCategory = {
  id: string;
  label: string;
  description?: string;
};

export type KnowledgeSource = {
  id: string;
  type:
    | 'manual'
    | 'faq'
    | 'knowledge_base'
    | 'google_drive'
    | 'onedrive'
    | 'notion'
    | 'confluence'
    | 'github'
    | 'website'
    | 'ocr'
    | 'image'
    | 'youtube';
  label: string;
  enabled: boolean;
};

export const preparedKnowledgeSources: KnowledgeSource[] = [
  { id: 'manual', type: 'manual', label: 'Manual import', enabled: true },
  { id: 'faq', type: 'faq', label: 'Existing FAQ', enabled: true },
  { id: 'knowledge_base', type: 'knowledge_base', label: 'Existing Knowledge Base', enabled: true },
  { id: 'google_drive', type: 'google_drive', label: 'Google Drive', enabled: false },
  { id: 'onedrive', type: 'onedrive', label: 'OneDrive', enabled: false },
  { id: 'notion', type: 'notion', label: 'Notion', enabled: false },
  { id: 'confluence', type: 'confluence', label: 'Confluence', enabled: false },
  { id: 'github', type: 'github', label: 'GitHub', enabled: false },
  { id: 'website', type: 'website', label: 'Website crawler', enabled: false },
  { id: 'ocr', type: 'ocr', label: 'OCR', enabled: false },
  { id: 'image', type: 'image', label: 'Images', enabled: false },
  { id: 'youtube', type: 'youtube', label: 'YouTube', enabled: false }
];
