import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Fetch total app users and registered Expo push tokens count
 */
export const getRegisteredPushTokensCount = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'app_users'));
    const uniqueTokens = new Set();
    usersSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.expoPushToken && typeof data.expoPushToken === 'string') {
        uniqueTokens.add(data.expoPushToken.trim());
      }
    });
    return {
      totalUsers: usersSnapshot.size,
      registeredDevices: uniqueTokens.size,
    };
  } catch (error) {
    console.error('Error fetching push token stats:', error);
    return { totalUsers: 0, registeredDevices: 0 };
  }
};

/**
 * Helper to post message to Expo push API via proxy with direct fallback
 */
async function postToExpoPush(message) {
  let response;
  let fetchError = null;

  try {
    response = await fetch('/api/expo-push', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (err) {
    fetchError = err;
  }

  // If proxy 404s or failed network fetch, attempt direct expo host
  if (!response || !response.ok) {
    try {
      const directResponse = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      if (directResponse.ok || !response) {
        response = directResponse;
      }
    } catch (directErr) {
      if (!response && fetchError) {
        throw fetchError;
      }
    }
  }

  if (!response) {
    throw new Error('Failed to reach push notification server.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const msg = data?.error || data?.errors?.[0]?.message || `Push service returned error ${response.status}`;
    throw new Error(msg);
  }

  return data;
}

/**
 * Send push notification about today's gold and silver rates
 */
export const sendGoldRateNotification = async (goldRate, silverRate) => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'app_users'));
    const tokens = [];
    const uniqueTokens = new Set();

    usersSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.expoPushToken && typeof data.expoPushToken === 'string') {
        const token = data.expoPushToken.trim();
        if (token && !uniqueTokens.has(token)) {
          uniqueTokens.add(token);
          tokens.push(token);
        }
      }
    });

    if (tokens.length === 0) {
      throw new Error('No registered mobile devices found with push tokens.');
    }

    const title = "Today's Gold Rate is Live! ✨";
    const body = `Gold Rate: ₹${goldRate} / gram. Silver Rate: ₹${silverRate} / gram.`;

    const message = {
      to: tokens,
      sound: 'default',
      title,
      body,
      data: { goldRate, silverRate, type: 'gold_rate' },
    };

    const data = await postToExpoPush(message);

    // Save record to app_notifications
    try {
      await addDoc(collection(db, 'app_notifications'), {
        title,
        body,
        type: 'gold_rate',
        goldRate,
        silverRate,
        recipientsCount: tokens.length,
        createdAt: new Date().toISOString(),
        status: 'sent',
      });
    } catch (saveErr) {
      console.warn('Could not record notification in Firestore:', saveErr);
    }

    return { success: true, count: tokens.length, data };
  } catch (error) {
    console.error('Error sending gold rate push notifications:', error);
    throw error;
  }
};

/**
 * Send custom push notification
 */
export const sendCustomNotification = async (title, body) => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'app_users'));
    const tokens = [];
    const uniqueTokens = new Set();

    usersSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.expoPushToken && typeof data.expoPushToken === 'string') {
        const token = data.expoPushToken.trim();
        if (token && !uniqueTokens.has(token)) {
          uniqueTokens.add(token);
          tokens.push(token);
        }
      }
    });

    if (tokens.length === 0) {
      throw new Error('No registered mobile devices found with push tokens.');
    }

    const finalTitle = title?.trim() || 'New Notification';
    const finalBody = body?.trim() || '';

    const message = {
      to: tokens,
      sound: 'default',
      title: finalTitle,
      body: finalBody,
      data: { custom: true, type: 'custom' },
    };

    const data = await postToExpoPush(message);

    // Save record to app_notifications
    try {
      await addDoc(collection(db, 'app_notifications'), {
        title: finalTitle,
        body: finalBody,
        type: 'custom',
        recipientsCount: tokens.length,
        createdAt: new Date().toISOString(),
        status: 'sent',
      });
    } catch (saveErr) {
      console.warn('Could not record notification in Firestore:', saveErr);
    }

    return { success: true, count: tokens.length, data };
  } catch (error) {
    console.error('Error sending custom push notifications:', error);
    throw error;
  }
};
