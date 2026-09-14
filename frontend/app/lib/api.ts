const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const fetchDashboardData = async (keluargaId: number) => {
  const response = await fetch(`/api/keluarga/${keluargaId}/dashboard`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }
  return response.json();
};

export const fetchRekening = async (keluargaId: number) => {
  const response = await fetch(`/api/keluarga/${keluargaId}/rekening`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to fetch rekening');
  }
  return response.json();
};
