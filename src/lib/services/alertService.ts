import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  type QueryDocumentSnapshot 
} from 'firebase/firestore';
import type { AlertEntry, AlertDocument } from '@/types/alert';

export class AlertService {
  private readonly collectionName = 'alerts';

  async saveUniqueAlert(alert: Omit<AlertEntry, 'createdAt'>): Promise<boolean> {
    try {
      // Check if alert already exists
      const alertsRef = collection(db, this.collectionName);
      const q = query(
        alertsRef, 
        where('title', '==', alert.title),
        where('published', '==', alert.published)
      );
      
      const querySnapshot = await getDocs(q);
      
      // If alert doesn't exist, save it
      if (querySnapshot.empty) {
        await addDoc(alertsRef, {
          ...alert,
          createdAt: serverTimestamp()
        });
        return true; // Alert was saved
      }
      
      return false; // Alert already existed
    } catch (error) {
      console.error('Error saving alert:', error);
      return false;
    }
  }

  async getAlertsByKeyword(keyword: string): Promise<AlertDocument[]> {
    try {
      const alertsRef = collection(db, this.collectionName);
      const q = query(alertsRef, where('keyword', '==', keyword));
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(this.convertToAlertDocument);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return [];
    }
  }

  private convertToAlertDocument(doc: QueryDocumentSnapshot): AlertDocument {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      content: data.content,
      link: data.link,
      published: data.published,
      source: data.source,
      keyword: data.keyword,
      createdAt: data.createdAt.toDate().toISOString()
    };
  }
}

// Export singleton instance
export const alertService = new AlertService();