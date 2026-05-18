import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveDatasetId } from "@/lib/store";

export function useDatasets() {
  return useQuery({
    queryKey: ["datasets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("datasets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCrimes() {
  const datasetId = useActiveDatasetId();
  return useQuery({
    queryKey: ["crimes", datasetId],
    enabled: !!datasetId,
    queryFn: async () => {
      if (!datasetId) return [];
      // Page through to avoid 1000-row limit
      const all: any[] = [];
      const PAGE = 1000;
      for (let from = 0; from < 250000; from += PAGE) {
        const { data, error } = await supabase.from("crimes")
          .select("id, occurred_at, primary_type, description, location_description, arrest, domestic, district, latitude, longitude")
          .eq("dataset_id", datasetId).range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
      }
      return all;
    },
  });
}
