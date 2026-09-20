"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SelectionBar } from "@/components/client-gallery/selection-bar";

export function HomeSelectionBar({ slug, count, submitted }: { slug: string; count: number; submitted: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(submitted);
  return (
    <SelectionBar
      count={count}
      error={null}
      onCleared={() => {
        setDone(false);
        router.refresh();
      }}
      onSubmitted={() => {
        setDone(true);
        router.refresh();
      }}
      slug={slug}
      submitted={done}
    />
  );
}