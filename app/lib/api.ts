export const getBaseUrl = () => {
  // On Vercel, VERCEL_URL points to the deployment URL (without protocol)
  // The vercel.json rewrites /api/* to the Python serverless function
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_VERCEL_URL) return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  return 'http://localhost:3000';
};

export const fetchDashboardData = async (keluargaId: number) => {
  try {
    const url = `${getBaseUrl()}/api/keluarga/${keluargaId}/dashboard`;
    console.log('[fetchDashboardData] Fetching:', url);
    const response = await fetch(url, { cache: 'no-store' });
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[fetchDashboardData] Non-JSON response:', text.substring(0, 200));
      throw new Error(`API returned non-JSON response (${response.status}). The Python backend may not be running.`);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Fetch dashboard data failed:", error);
    throw error;
  }
};
