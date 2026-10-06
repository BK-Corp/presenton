"use client";

import { Check, ChevronDown, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LOCALES,
  LOCALE_LABELS,
  useLanguage,
  type Locale,
} from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function UiLanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={t("common.uiLanguage")}
          title={t("common.uiLanguage")}
          className={cn(
            "gap-2 rounded-full bg-white font-syne text-[#191919]",
            compact ? "h-[34px] px-3 text-xs" : "h-9 px-3.5 text-xs",
          )}
        >
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{LOCALE_LABELS[locale]}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {LOCALES.map((code: Locale) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => setLocale(code)}
            className="cursor-pointer gap-2"
          >
            <Check
              className={cn("h-4 w-4", locale === code ? "opacity-100" : "opacity-0")}
              aria-hidden="true"
            />
            {LOCALE_LABELS[code]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
