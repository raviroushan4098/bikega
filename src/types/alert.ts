export interface AlertEntry {
  id: string;
  title: string;
  content: string;
  link: string;
  published: string;
  source: string;
  keyword: string;
  createdAt: Date;
}

export interface AlertDocument extends Omit<AlertEntry, 'createdAt'> {
  createdAt: string; // Firestore timestamp will be converted to string
}