'use client'
import React from "react";

import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import PdfMakerPage from "./PdfMakerPage";
const page = () => {

    const router = useRouter();
    const t = useT();
    const params = useSearchParams();
    const queryId = params.get("id");
    const exportCookie = params.get("exportCookie") ?? undefined;
    if (!queryId) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <h1 className="text-2xl font-bold">{t("common.noPresentationId")}</h1>
                <p className="text-gray-500 pb-4">{t("common.pleaseTryAgain")}</p>
                <Button onClick={() => router.push("/dashboard")}>{t("common.goToHome")}</Button>
            </div>
        );
    }
    return (
        <PdfMakerPage presentation_id={queryId} exportCookie={exportCookie} />
    );
};
export default page;
