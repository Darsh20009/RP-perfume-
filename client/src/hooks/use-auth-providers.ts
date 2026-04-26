import { useQuery } from "@tanstack/react-query";

type ProviderInfo = { clientId?: string; enabled?: boolean };

/**
 * Returns which OAuth providers (Google / Apple) are actually configured
 * on the server. Buttons should be hidden when the corresponding provider
 * has no client ID — otherwise users see a button that returns 503.
 */
export function useAuthProviders() {
  const google = useQuery<ProviderInfo>({
    queryKey: ["/api/auth/google/init"],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const apple = useQuery<ProviderInfo>({
    queryKey: ["/api/auth/apple/init"],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const googleEnabled = !!(google.data?.enabled ?? google.data?.clientId);
  const appleEnabled = !!(apple.data?.clientId);

  return {
    googleEnabled,
    appleEnabled,
    anyEnabled: googleEnabled || appleEnabled,
    isLoading: google.isLoading || apple.isLoading,
  };
}
