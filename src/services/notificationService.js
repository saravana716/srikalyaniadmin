import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

export const sendGoldRateNotification = async (goldRate, silverRate) => {
  try {
    // 1. Fetch all users
    const usersSnapshot = await getDocs(collection(db, 'app_users'));
    const tokens = [];
    const uniqueTokens = new Set();

    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.expoPushToken && typeof data.expoPushToken === 'string') {
        if (!uniqueTokens.has(data.expoPushToken)) {
            uniqueTokens.add(data.expoPushToken);
            tokens.push(data.expoPushToken);
        }
      }
    });

    if (tokens.length === 0) {
      console.log('No users with push tokens found.');
      return;
    }

    // 2. Create the message
    const message = {
      to: tokens,
      sound: 'default',
      title: "Today's Gold Rate is Live! ✨",
      body: `Gold Rate: ₹${goldRate} / gram. Silver Rate: ₹${silverRate} / gram.`,
      data: { goldRate, silverRate },
    };

    // 3. Send via serverless API to bypass CORS
    const response = await fetch('/api/expo-push', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const data = await response.json();
    console.log('Push notification response:', data);
    return data;
  } catch (error) {
    console.error('Error sending push notifications:', error);
    throw error;
  }
};

export const sendCustomNotification = async (title, body) => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'app_users'));
    const tokens = [];
    const uniqueTokens = new Set();

    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.expoPushToken && typeof data.expoPushToken === 'string') {
        if (!uniqueTokens.has(data.expoPushToken)) {
            uniqueTokens.add(data.expoPushToken);
            tokens.push(data.expoPushToken);
        }
      }
    });

    if (tokens.length === 0) {
      console.log('No users with push tokens found.');
      return;
    }

    const message = {
      to: tokens,
      sound: 'default',
      title: title || 'New Notification',
      body: body,
      data: { custom: true },
    };

    const response = await fetch('/api/expo-push', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending custom push notifications:', error);
    throw error;
  }
};
