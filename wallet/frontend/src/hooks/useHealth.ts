import { useState, useEffect } from 'react';
import { checkBackendHealth } from '../services/api';
import { HealthStatus } from '../types';

export function useHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshHealth = async () => {
    setLoading(true);
    const result = await checkBackendHealth();
    setHealth(result);
    setLoading(false);
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  return { health, loading, refreshHealth };
}
