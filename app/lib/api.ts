export const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_VERCEL_URL) return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
};

export const fetchDashboardData = async (keluargaId: number) => {
  try {
    const url = `${getBaseUrl()}/api/keluarga/${keluargaId}/dashboard`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Fetch dashboard data failed:", error);
    throw error;
  }
};
