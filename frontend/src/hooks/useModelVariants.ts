"use client";

import { useState, useEffect } from "react";
import { api, type ModelVariant } from "@/lib/api";
import { modelVariants as defaultVariants } from "@/constants";

interface UseModelVariantsReturn {
  variants: ModelVariant[];
  isLoading: boolean;
  error: Error | null;
  defaultVariant: ModelVariant | undefined;
}

export function useModelVariants(): UseModelVariantsReturn {
  const [variants, setVariants] = useState<ModelVariant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.getModelVariants()
      .then((data) => {
        setVariants(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch model variants:", err);
        setError(err);
        // Fall back to default variants from constants
        setVariants(defaultVariants.map(v => ({
          id: v.id,
          name: v.name,
          description: v.description,
          baseModel: v.baseModel,
          baseModelName: v.baseModelName,
          isRecommended: v.isRecommended,
        })));
        setIsLoading(false);
      });
  }, []);

  const defaultVariant = variants.find(v => v.isRecommended) || variants[0];

  return { variants, isLoading, error, defaultVariant };
}
