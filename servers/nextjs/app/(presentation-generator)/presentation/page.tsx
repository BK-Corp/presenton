'use client'
import React from "react";
import PresentationPage from "./components/PresentationPage";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import "../utils/prism-languages";
const page = () => {

  const router = useRouter();
  const t = useT();
  const params = useSearchParams();
  const queryId = params.get("id");
  if (!queryId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen font-syne">
        <h1 className="text-2xl font-bold">{t("common.noPresentationId")}</h1>
        <p className="text-gray-500 pb-4">{t("common.pleaseTryAgain")}</p>
        <Button onClick={() => router.push("/dashboard")}>{t("common.goToHome")}</Button>
      </div>
    );
  }
  return (

    <PresentationPage presentation_id={queryId} />

  );
};
export default page;
